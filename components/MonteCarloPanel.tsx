"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import initWasm, { monte_carlo_max_temp as wasmMonteCarlo } from "../public/wasm/wasm_predict.js";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { OU_MONTHS } from "@/lib/ouParams";
import { detectRegime } from "@/lib/ouRegime";
import {
  Cpu,
  Loader2,
  Thermometer,
  Shuffle,
  Info,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonteCarloResult {
  mean: number;
  std: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  prob_above_30: number;
  prob_above_31: number;
  prob_above_32: number;
  prob_above_33: number;
  prob_above_34: number;
  blended_start: number;
  n_sims: number;
}

interface MonteCarloFanPoint {
  label: string;
  base: number;
  band5_10_lo: number;
  band10_25_lo: number;
  band25_75: number;
  band10_25_hi: number;
  band5_10_hi: number;
}

interface Props {
  currentTemp: number | null;
  tomorrowForecast: number | null;
  currentMonthIdx: number;
}

// ─── Threshold config ─────────────────────────────────────────────────────────
const THRESHOLDS = [30, 31, 32, 33, 34] as const;

// ─── Probability helpers ──────────────────────────────────────────────────────
function probColor(p: number): string {
  if (p >= 75) return "text-rose-600 dark:text-rose-400";
  if (p >= 50) return "text-amber-600 dark:text-amber-400";
  if (p >= 25) return "text-sky-600 dark:text-sky-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function probBg(p: number): string {
  if (p >= 75) return "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60";
  if (p >= 50) return "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60";
  if (p >= 25) return "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60";
  return "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60";
}

// ─── Custom Tooltip (pure function, NOT passed as JSX element to Recharts) ────
interface TooltipPayloadEntry {
  name: string;
  value: number;
  fill: string;
}

interface FanChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function renderFanChartTooltip({ active, payload, label }: FanChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const isToday = label === "Hari ini";
  const bandNames: Record<string, string> = {
    band5_10_lo: "P5\u2013P10",
    band10_25_lo: "P10\u2013P25",
    band25_75: "P25\u2013P75 (IQR)",
    band10_25_hi: "P75\u2013P90",
    band5_10_hi: "P90\u2013P95",
  };

  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xl text-xs space-y-1.5"
      style={{ minWidth: 200 }}
    >
      <p className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-2">
        {isToday ? "📍 Hari ini" : "🌅 Besok (Distribusi MC)"}
      </p>
      {payload.map((entry, i) => {
        if (entry.name === "base") return null;
        const label = bandNames[entry.name] ?? entry.name;
        return (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: entry.fill }}
            />
            <span className="text-slate-600 dark:text-slate-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonteCarloPanel({
  currentTemp,
  tomorrowForecast,
  currentMonthIdx,
}: Props) {
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);
  const [ecmwfWeight, setEcmwfWeight] = useState(0.4);
  const [nSims, setNSims] = useState(10000);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [wasmReady, setWasmReady] = useState(false);
  const startTimeRef = useRef<number>(0);

  const activeMonth = React.useMemo(() => OU_MONTHS[currentMonthIdx], [currentMonthIdx]);
  const regime = React.useMemo(() => detectRegime(currentMonthIdx), [currentMonthIdx]);

  // Initialize WASM once on mount
  useEffect(() => {
    initWasm({ module_or_path: "/wasm/wasm_predict_bg.wasm" })
      .then(() => setWasmReady(true))
      .catch(() => setError("Gagal memuat modul WASM"));
  }, []);

  const runSimulation = useCallback(async () => {
    if (currentTemp === null || tomorrowForecast === null || !wasmReady) return;
    setIsLoading(true);
    setError(null);
    try {
      startTimeRef.current = performance.now();
      const seed = BigInt(Date.now() & 0xffffffff);
      const res = wasmMonteCarlo(
        currentTemp,
        tomorrowForecast,
        activeMonth.mean,
        activeMonth.sigma,
        regime.dynamicTheta,
        ecmwfWeight,
        nSims,
        seed
      ) as MonteCarloResult;
      setElapsedMs(Math.round(performance.now() - startTimeRef.current));
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menjalankan simulasi");
    } finally {
      setIsLoading(false);
    }
  }, [currentTemp, tomorrowForecast, activeMonth.mean, activeMonth.sigma, regime.dynamicTheta, ecmwfWeight, nSims, wasmReady]);


  // Auto-run when WASM becomes ready or inputs change
  useEffect(() => {
    if (!wasmReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSimulation();
  }, [runSimulation, wasmReady]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData: MonteCarloFanPoint[] = [];

  if (currentTemp !== null && result !== null) {
    chartData.push({
      label: "Hari ini",
      base: currentTemp,
      band5_10_lo: 0,
      band10_25_lo: 0,
      band25_75: 0,
      band10_25_hi: 0,
      band5_10_hi: 0,
    });
    const { p5, p10, p25, p75, p90, p95 } = result;
    chartData.push({
      label: "Besok",
      base: p5,
      band5_10_lo: p10 - p5,
      band10_25_lo: p25 - p10,
      band25_75: result.p75 - p25,
      band10_25_hi: p90 - p75,
      band5_10_hi: p95 - p90,
    });
  }

  const thresholdProbs: Record<number, number> = {
    30: result?.prob_above_30 ?? 0,
    31: result?.prob_above_31 ?? 0,
    32: result?.prob_above_32 ?? 0,
    33: result?.prob_above_33 ?? 0,
    34: result?.prob_above_34 ?? 0,
  };

  const hasMissingInputs = currentTemp === null || tomorrowForecast === null;
  const yMin = result ? Math.floor(result.p5 - 0.5) : 28;
  const yMax = result ? Math.ceil(result.p95 + 0.5) : 36;

  return (
    <section
      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden"
      aria-label="Monte Carlo Temperature Simulation Panel"
    >
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shuffle size={18} className="text-violet-500" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Monte Carlo Suhu Maks Besok
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
              Distribusi probabilistik suhu tertinggi besok berdasarkan{" "}
              <strong>{nSims.toLocaleString()} jalur simulasi</strong> stokastik
              menggunakan proses Ornstein-Uhlenbeck + koreksi Open-Meteo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 text-xs font-semibold border border-violet-200 dark:border-violet-800/60 animate-pulse">
                <Loader2 size={11} className="animate-spin" />
                Memproses…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 text-xs font-semibold border border-violet-200 dark:border-violet-800/60">
                <Cpu size={11} />
                RUST WASM ⚡
                {elapsedMs !== null && (
                  <span className="text-violet-400 dark:text-violet-500 font-normal">
                    {elapsedMs}ms
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono">
            μ = {activeMonth.mean}°C ({activeMonth.month})
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono">
            σ = {activeMonth.sigma}°C
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono">
            θ = {regime.dynamicTheta.toFixed(3)} ({regime.labelShort})
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono">
            w_OM = {(ecmwfWeight * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* ── Alerts ── */}
      {hasMissingInputs && (
        <div className="mx-6 mt-5 flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
              Data Input Tidak Lengkap
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              {currentTemp === null && "Suhu hari ini tidak tersedia. "}
              {tomorrowForecast === null && "Prakiraan Open-Meteo besok tidak tersedia. "}
              Panel ini memerlukan kedua nilai tersebut untuk menjalankan simulasi.
            </p>
          </div>
        </div>
      )}
      {error && (
        <div className="mx-6 mt-5 flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
          <AlertTriangle size={18} className="text-rose-500 flex-shrink-0" />
          <p className="text-sm text-rose-700 dark:text-rose-400">
            Gagal menjalankan simulasi: {error}
          </p>
        </div>
      )}

      <div className="px-6 py-5 space-y-6">
        {/* ── Input Source Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Thermometer size={14} className="text-orange-500" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Suhu Hari Ini
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {currentTemp !== null ? `${currentTemp.toFixed(1)}°C` : "–"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              METAR / ECMWF (kondisi awal)
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-sky-500" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Open-Meteo Besok
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {tomorrowForecast !== null ? `${tomorrowForecast.toFixed(1)}°C` : "–"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              T_max prakiraan NWP global
            </p>
          </div>

          <div className="rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/60 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shuffle size={14} className="text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                Titik Awal Simulasi
              </span>
            </div>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
              {result ? `${result.blended_start.toFixed(1)}°C` : "–"}
            </p>
            <p className="text-xs text-violet-400 dark:text-violet-500 mt-1">
              {(ecmwfWeight * 100).toFixed(0)}% OM +{" "}
              {((1 - ecmwfWeight) * 100).toFixed(0)}% OU gravitasi
            </p>
          </div>
        </div>

        {/* ── Fan Chart ── */}
        {result !== null && !hasMissingInputs && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <span>Distribusi Probabilistik T_max Besok</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                (Fan Chart dari {nSims.toLocaleString()} simulasi)
              </span>
            </h3>

            <div className="relative h-[280px] sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="mcOuter" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="mcMid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.15} />
                    </linearGradient>
                    <linearGradient id="mcCore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6d28d9" stopOpacity={0.65} />
                      <stop offset="95%" stopColor="#6d28d9" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.12} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    tickFormatter={(v: number) => `${v}°`}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                  />

                  {/* Tooltip uses render-prop to avoid React #185 hook check */}
                  <Tooltip
                    content={(props) =>
                      renderFanChartTooltip({
                        active: props.active,
                        payload: props.payload as unknown as TooltipPayloadEntry[] | undefined,
                        label: props.label as string | undefined,
                      })

                    }
                  />

                  {/* Stacked fan layers */}
                  <Area
                    type="monotone"
                    dataKey="base"
                    stackId="fan"
                    stroke="none"
                    fill="transparent"
                    name="base"
                    legendType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="band5_10_lo"
                    stackId="fan"
                    stroke="none"
                    fill="url(#mcOuter)"
                    name="band5_10_lo"
                    legendType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="band10_25_lo"
                    stackId="fan"
                    stroke="none"
                    fill="url(#mcMid)"
                    name="band10_25_lo"
                    legendType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="band25_75"
                    stackId="fan"
                    stroke="#7c3aed"
                    strokeWidth={1.5}
                    fill="url(#mcCore)"
                    name="band25_75"
                    legendType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="band10_25_hi"
                    stackId="fan"
                    stroke="none"
                    fill="url(#mcMid)"
                    name="band10_25_hi"
                    legendType="none"
                  />
                  <Area
                    type="monotone"
                    dataKey="band5_10_hi"
                    stackId="fan"
                    stroke="none"
                    fill="url(#mcOuter)"
                    name="band5_10_hi"
                    legendType="none"
                  />

                  <ReferenceLine
                    y={activeMonth.mean}
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    label={{
                      value: `μ=${activeMonth.mean}°C`,
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "#6366f1",
                    }}
                  />
                  {result && (
                    <ReferenceLine
                      y={result.p50}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      label={{
                        value: `P50=${result.p50.toFixed(1)}°`,
                        position: "insideBottomRight",
                        fontSize: 10,
                        fill: "#f59e0b",
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Manual CSS Legend (replaces Recharts Legend to avoid hook issues) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 px-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(109,40,217,0.55)" }} />
                P25–P75 (IQR)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(124,58,237,0.28)" }} />
                P10–P25 / P75–P90
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(139,92,246,0.12)" }} />
                P5–P10 / P90–P95
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 border-t-2 border-dashed border-indigo-500" />
                Jangkar μ OU
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 border-t-2 border-dashed border-amber-500" />
                Median P50
              </span>
            </div>
          </div>
        )}

        {/* ── Percentile Cards ── */}
        {result && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Distribusi Persentil T_max Besok
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {(
                [
                  ["P5", result.p5],
                  ["P10", result.p10],
                  ["P25", result.p25],
                  ["P50", result.p50],
                  ["P75", result.p75],
                  ["P90", result.p90],
                  ["P95", result.p95],
                ] as [string, number][]
              ).map(([pLabel, val]) => {
                const isMedian = pLabel === "P50";
                return (
                  <div
                    key={pLabel}
                    className={`rounded-xl p-3 text-center transition-all border ${
                      isMedian
                        ? "bg-violet-600 dark:bg-violet-700 border-violet-500 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/40"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/50 text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold mb-1 ${
                        isMedian ? "text-violet-200" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {pLabel}
                    </div>
                    <div className={`text-base font-bold ${isMedian ? "text-white" : ""}`}>
                      {val.toFixed(1)}°
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-400 dark:text-slate-500">
              <span>Rata-rata: {result.mean.toFixed(2)}°C</span>
              <span>Std Dev: ±{result.std.toFixed(2)}°C</span>
              <span>{result.n_sims.toLocaleString()} simulasi</span>
            </div>
          </div>
        )}

        {/* ── Threshold Probability Table ── */}
        {result && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Peluang Melebihi Threshold Suhu Besok
            </h3>
            <div className="space-y-2.5">
              {THRESHOLDS.map((thr) => {
                const prob = thresholdProbs[thr];
                const barWidth = Math.min(prob, 100);
                return (
                  <div
                    key={thr}
                    id={`mc-threshold-${thr}`}
                    className={`rounded-xl border p-3.5 ${probBg(prob)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        T_max besok &gt; {thr}°C
                      </span>
                      <span className={`text-base font-bold tabular-nums ${probColor(prob)}`}>
                        {prob.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          prob >= 75
                            ? "bg-rose-500"
                            : prob >= 50
                              ? "bg-amber-500"
                              : prob >= 25
                                ? "bg-sky-500"
                                : "bg-emerald-500"
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Parameter Controls ── */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50 p-4 space-y-4">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Parameter Simulasi
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="mc-ecmwf-weight"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Bobot Open-Meteo:{" "}
                <strong className="text-violet-600 dark:text-violet-400">
                  {(ecmwfWeight * 100).toFixed(0)}%
                </strong>
              </label>
              <input
                id="mc-ecmwf-weight"
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={ecmwfWeight}
                onChange={(e) => setEcmwfWeight(parseFloat(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
                <span>0% (OU murni)</span>
                <span>80% (OM dominan)</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="mc-n-sims"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Jumlah Simulasi
              </label>
              <select
                id="mc-n-sims"
                value={nSims}
                onChange={(e) => setNSims(parseInt(e.target.value))}
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value={1000}>1.000 (cepat)</option>
                <option value={5000}>5.000</option>
                <option value={10000}>10.000 (recommended)</option>
                <option value={50000}>50.000 (presisi tinggi)</option>
              </select>
            </div>
          </div>

          <button
            id="mc-run-button"
            onClick={runSimulation}
            disabled={isLoading || hasMissingInputs || !wasmReady}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-semibold transition-all duration-200 shadow-md shadow-violet-200 dark:shadow-violet-900/40 hover:shadow-lg active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Mensimulasikan…
              </>
            ) : (
              <>
                <Shuffle size={15} />
                Jalankan Ulang Simulasi
              </>
            )}
          </button>
        </div>

        {/* ── Methodology Toggle ── */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            id="mc-methodology-toggle"
            onClick={() => setShowMethodology((p) => !p)}
            className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <Info size={13} />
            <span>Metodologi &amp; Asumsi Simulasi</span>
            {showMethodology ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showMethodology && (
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-2 leading-relaxed bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-700/50">
              <p>
                <strong className="text-slate-700 dark:text-slate-300">
                  Proses Ornstein-Uhlenbeck (OU):
                </strong>{" "}
                Setiap jalur simulasi mengikuti SDE{" "}
                <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded text-violet-600 dark:text-violet-400">
                  dT = θ(μ - T)dt + σdW
                </code>{" "}
                dengan langkah waktu hourly (Δt = 1/24 hari) selama 24 jam.
              </p>
              <p>
                <strong className="text-slate-700 dark:text-slate-300">Gravitasi Jangkar OU:</strong>{" "}
                Parameter μ (mean bulanan) dan θ (kecepatan mean-reversion) dari data klimatologi
                Changi Airport berfungsi sebagai &quot;gaya tarik&quot; yang menstabilkan jalur
                simulasi agar tidak menyimpang terlalu jauh dari rata-rata historis.
              </p>
              <p>
                <strong className="text-slate-700 dark:text-slate-300">Koreksi Open-Meteo:</strong>{" "}
                Titik awal simulasi besok adalah rata-rata berbobot antara prakiraan OU mandiri dan
                prakiraan T_max dari NWP global Open-Meteo. Bobot dapat dikonfigurasi.
              </p>
              <p>
                <strong className="text-slate-700 dark:text-slate-300">PRNG:</strong>{" "}
                Menggunakan algoritma XorShift64 + transformasi Box-Muller untuk menghasilkan
                bilangan acak berdistribusi normal tanpa memerlukan library eksternal. Seluruh
                kalkulasi berjalan di Rust WASM (&le;5ms untuk 10.000 iterasi).
              </p>
              <p>
                <strong className="text-slate-700 dark:text-slate-300">T_max per jalur:</strong>{" "}
                Hanya nilai suhu pada jendela puncak diurnal (jam 10:00–17:00 waktu lokal) yang
                dicatat sebagai T_max dari setiap jalur, karena Changi Airport paling sering
                mencapai puncak harian di rentang waktu tersebut.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
