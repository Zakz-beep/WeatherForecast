export interface MetarData {
  icaoId: string;
  receiptTime: string;
  obsTime: number;
  reportTime: string;
  temp: number;
  dewp: number;
  wdir: number;
  wspd: number;
  wgst: number | null;
  visib: number;
  altim: number;
  slp: number;
  wxString: string | null;
  rawOb: string;
  lat: number;
  lon: number;
  elev: number;
  name: string;
  cover?: string;
  clouds?: Array<{ cover: string; base: number }>;
  fltCat?: string;
}

export async function getNearbyMetar(lat: number, lon: number): Promise<MetarData | null> {
  const diff = 0.5; // roughly 55km bounding box
  const minLat = lat - diff;
  const maxLat = lat + diff;
  const minLon = lon - diff;
  const maxLon = lon + diff;
  
  const url = `https://aviationweather.gov/api/data/metar?bbox=${minLat},${minLon},${maxLat},${maxLon}&format=json`;
  
  try {
    const res = await fetch(url);
    const data: MetarData[] = await res.json();
    if (data && data.length > 0) {
      // Find the closest one
      let closest = data[0];
      let minDistance = Number.MAX_VALUE;
      for (const station of data) {
        const dist = Math.sqrt(Math.pow(station.lat - lat, 2) + Math.pow(station.lon - lon, 2));
        if (dist < minDistance) {
          minDistance = dist;
          closest = station;
        }
      }
      return closest;
    }
    return null;
  } catch (error) {
    console.error("Error fetching METAR data:", error);
    return null;
  }
}

export async function getHistoricalMetar(icaoId: string, hours: number = 48): Promise<MetarData[]> {
  const url = `https://aviationweather.gov/api/data/metar?ids=${icaoId}&format=json&hours=${hours}`;
  try {
    const res = await fetch(url);
    const data: MetarData[] = await res.json();
    return data || [];
  } catch (error) {
    console.error("Error fetching historical METAR:", error);
    return [];
  }
}

// ── 4-Stage METAR Temperature Estimation Pipeline ────────────────────────────

import { OU_MONTHS } from "@/lib/ouParams";

/** Singapore diurnal peak hour in SGT (UTC+8) */
const DIURNAL_PEAK_HOUR_SGT = 14;
const PEAK_WINDOW_START_SGT = 12;  // peak window opens at 12:00 SGT
const PEAK_WINDOW_END_SGT   = 16;  // peak window closes at 16:00 SGT

export interface TempEstimate {
  /** QC-filtered observed max temperature in last 24 h */
  observedMax: number;
  /** True once current SGT hour >= PEAK_WINDOW_END or peak already surpassed */
  isPeakReached: boolean;
  /** Projected or observed daily maximum */
  estimatedDailyPeak: number;
  /** Final value to feed into the OU model (after bias correction) */
  correctedPeak: number;
  /** Confidence level of the estimate */
  confidence: "HIGH" | "MED" | "LOW";
  /** Whether correctedPeak comes from actual observation or diurnal projection */
  source: "OBSERVED" | "ESTIMATED";
  /** Current hour in SGT for display */
  currentHourSGT: number;
  /** QC statistics */
  dataQuality: {
    total: number;   // observations in last 24 h
    valid: number;   // after QC filter
    removed: number; // removed by QC
  };
  /** Stage 4 bias correction applied (°C) */
  biasCorrection: number;
}

/**
 * Compute a METAR-corrected daily temperature estimate using a 4-stage pipeline:
 *   Stage 1 — QC: remove outliers (|T−μ| > 4σ) and instrument spikes (|ΔT| > 5°C/h)
 *   Stage 2 — Diurnal awareness: determine if we're in/past Singapore's peak window
 *   Stage 3 — Peak estimation: project to 14:00 SGT via diurnal model if not yet reached
 *   Stage 4 — Empirical correction: deflate estimated peaks by 0.15°C (model optimism bias)
 */
export function computeTempEstimate(metarHistory: MetarData[]): TempEstimate {
  const now = new Date();
  const currentHourSGT = (now.getUTCHours() + 8) % 24;
  const monthIdx = now.getMonth();
  const { mean: mu, sigma, diurnalAmplitude } = OU_MONTHS[monthIdx];

  // ── Stage 1: Quality Control ──────────────────────────────────────────────
  const oneDayAgoSec = Date.now() / 1000 - 86400;
  const recent = metarHistory.filter((o) => o.obsTime >= oneDayAgoSec);
  const total = recent.length;

  // Remove statistical outliers: |T − μ| > 4σ
  const outlierFiltered = recent.filter((o) => Math.abs(o.temp - mu) <= 4 * sigma);

  // Remove instrument spikes: |ΔT| > 5°C between consecutive observations
  const sorted = [...outlierFiltered].sort((a, b) => a.obsTime - b.obsTime);
  const spikeFiltered: MetarData[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { spikeFiltered.push(sorted[i]); continue; }
    if (Math.abs(sorted[i].temp - sorted[i - 1].temp) <= 5) {
      spikeFiltered.push(sorted[i]);
    }
  }
  const valid   = spikeFiltered.length;
  const removed = total - valid;

  const observedMax = valid > 0
    ? Math.max(...spikeFiltered.map((o) => o.temp))
    : mu; // fallback to climatological mean if no valid obs

  // ── Stage 2: Diurnal Cycle Awareness ─────────────────────────────────────
  // Peak is "reached" if we're past the peak window, or inside it and the
  // observed max already exceeds the climatological mean (good sign it's real).
  const inPeakWindow = currentHourSGT >= PEAK_WINDOW_START_SGT && currentHourSGT < PEAK_WINDOW_END_SGT;
  const isPeakReached =
    currentHourSGT >= PEAK_WINDOW_END_SGT ||
    (inPeakWindow && observedMax >= mu);

  // ── Stage 3: Diurnal Peak Estimation ─────────────────────────────────────
  // T(h) = μ + A·cos(2π·(h − peak_hour) / 24)   →  peak at h = 14
  const omega = (2 * Math.PI) / 24;
  let estimatedDailyPeak: number;
  let source: TempEstimate["source"];

  if (isPeakReached || currentHourSGT >= PEAK_WINDOW_START_SGT) {
    // Peak window reached or past: trust the observed max directly
    estimatedDailyPeak = observedMax;
    source = "OBSERVED";
  } else {
    // Pre-peak: project current temp forward to 14:00 SGT using diurnal model
    const latestTemp = spikeFiltered.length > 0
      ? spikeFiltered[spikeFiltered.length - 1].temp
      : mu;
    const factorNow  = Math.cos(omega * (currentHourSGT - DIURNAL_PEAK_HOUR_SGT));
    const factorPeak = 1.0; // cos(0) at peak hour
    const diurnalRise = diurnalAmplitude * (factorPeak - factorNow);
    estimatedDailyPeak = latestTemp + Math.max(0, diurnalRise);
    source = "ESTIMATED";
  }

  // ── Stage 4: Empirical Bias Correction ────────────────────────────────────
  // Diurnal projections tend to be slightly optimistic; observed values are ground truth.
  const biasCorrection = source === "ESTIMATED" ? -0.15 : 0;
  // Never correct below observed max (ground truth floor)
  const correctedPeak = Math.max(observedMax, estimatedDailyPeak + biasCorrection);

  // ── Confidence Level ──────────────────────────────────────────────────────
  let confidence: TempEstimate["confidence"];
  if (source === "OBSERVED" && valid >= 12) {
    confidence = "HIGH";
  } else if ((source === "OBSERVED" && valid >= 5) || (source === "ESTIMATED" && valid >= 8)) {
    confidence = "MED";
  } else {
    confidence = "LOW";
  }

  return {
    observedMax,
    isPeakReached,
    estimatedDailyPeak,
    correctedPeak,
    confidence,
    source,
    currentHourSGT,
    dataQuality: { total, valid, removed },
    biasCorrection,
  };
}
