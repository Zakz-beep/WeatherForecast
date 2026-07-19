"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Compass,
  HelpCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Layers,
  ChevronRight,
  BarChart2,
  Zap,
} from "lucide-react";

// ── Pure Math Helpers ──────────────────────────────────────────────────────────

/** Abramowitz & Stegun approximation for the Normal CDF, error < 7.5e-8 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422820 * Math.exp(-0.5 * x * x);
  const poly =
    t * (0.3193815302 +
      t * (-0.3565637813 +
        t * (1.7814779372 +
          t * (-1.8212559978 + t * 1.3302744929))));
  const cdf = 1 - d * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

/** Compute OU conditional mean & std for H+1 given current temp */
function ouForecast(
  current: number,
  mu: number,
  sigma: number,
  theta: number
) {
  const dt = 1; // 1 day
  const expNeg  = Math.exp(-theta * dt);
  const exp2Neg = Math.exp(-2 * theta * dt);
  const mean = mu + (current - mu) * expNeg;
  const variance = (sigma * sigma * (1 - exp2Neg)) / (2 * theta);
  const std = Math.sqrt(variance);
  return { mean, std };
}

/** Normal quantile z for common percentiles */
const Z_SCORES: Record<string, number> = {
  p5:  -1.6449,
  p10: -1.2816,
  p25: -0.6745,
  p50:  0,
  p75:  0.6745,
  p90:  1.2816,
  p95:  1.6449,
};

import type { TempEstimate } from "@/services/metarService";
import { OU_MONTHS } from "@/lib/ouParams";

interface OUMeanReversionPanelProps {
  tempEstimate: TempEstimate | null;
  todayForecastTemp: number | null;
}


export default function OUMeanReversionPanel({ tempEstimate, todayForecastTemp }: OUMeanReversionPanelProps) {
  // Dapatkan bulan berjalan secara otomatis (0-11)
  const currentMonthIdx = useMemo(() => new Date().getMonth(), []);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(currentMonthIdx);
  const [showExplanation, setShowExplanation] = useState(false);

  const selectedData = OU_MONTHS[selectedMonthIdx];
  const activeMonthData = OU_MONTHS[currentMonthIdx];

  // Use corrected peak from pipeline; fall back to ECMWF forecast if no METAR
  const referenceTemp = tempEstimate !== null ? tempEstimate.correctedPeak : todayForecastTemp;
  const isRealObs = tempEstimate !== null;


  // Hitung analisis deviasi jika forecast atau real temp hari ini tersedia
  const deviationAnalysis = useMemo(() => {
    if (referenceTemp == null) return null;
    
    // Bandingkan dengan jangkar gravitasi bulan ini (activeMonthData.mean)
    const deviation = referenceTemp - activeMonthData.mean;
    const absDev = Math.abs(deviation);
    
    // Kecepatan reversion teoritis untuk suhu harian Singapura (diperkirakan ~0.25 / hari)
    const theta = 0.25; 
    const correctionNextDay = deviation * theta;
    const expectedTempNextDay = referenceTemp - correctionNextDay;

    return {
      deviation,
      absDev,
      correctionNextDay,
      expectedTempNextDay,
      isAbove: deviation > 0,
      isWithinVol: absDev <= activeMonthData.sigma,
    };
  }, [referenceTemp, activeMonthData]);

  // ── Probabilistic Forecast for Tomorrow (H+1) ─────────────────────────────
  const theta = 0.25;
  const probabilisticForecast = useMemo(() => {
    if (referenceTemp == null) return null;
    const { mean, std } = ouForecast(
      referenceTemp,
      activeMonthData.mean,
      activeMonthData.sigma,
      theta
    );

    // Percentile temperatures
    const percentiles = Object.fromEntries(
      Object.entries(Z_SCORES).map(([key, z]) => [key, mean + z * std])
    );

    // Probability of exceeding key thresholds
    const thresholds = [30, 31, 32, 33, 34].map((t) => ({
      temp: t,
      probAbove: (1 - normalCDF((t - mean) / std)) * 100,
      probBelow: normalCDF((t - mean) / std) * 100,
    }));

    return { mean, std, percentiles, thresholds };
  }, [referenceTemp, activeMonthData]);

  // Persiapkan data untuk chart Recharts
  const chartData = useMemo(() => {
    return OU_MONTHS.map((d, index) => ({
      name: d.shortMonth,
      fullName: d.month,
      "Jangkar Gravitasi (\u03BC)": d.mean,
      "Batas Atas (+1\u03C3)": d.maxRange,
      "Batas Bawah (-1\u03C3)": d.minRange,
      // Envelope untuk diisi
      "Envelope": [d.minRange, d.maxRange],
      isSelected: index === selectedMonthIdx,
    }));
  }, [selectedMonthIdx]);


  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors w-full space-y-6 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Compass size={20} className="animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
              Jangkar Gravitasi Suhu (Mean Reversion OU)
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className="text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-450 transition-colors"
                title="Apa itu Ornstein-Uhlenbeck?"
              >
                <HelpCircle size={15} />
              </button>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Analisis parameter kesetimbangan climatology & volatilitas — WSSS Singapore
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
          <Layers size={12} />
          <span>Model Dinamis Ornstein-Uhlenbeck</span>
        </div>
      </div>

      {/* Info Teori Singkat (Expandable) */}
      {showExplanation && (
        <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/40 dark:border-indigo-900/25 rounded-2xl p-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400 space-y-2">
          <p className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
            <Info size={13} /> Mengenal Model Mean Reversion Ornstein-Uhlenbeck (OU)
          </p>
          <p>
            Dalam klimatologi, suhu udara tidak bergerak acak tak terbatas seperti model *Random Walk* saham. Karakteristik fisik atmosfer (seperti radiasi matahari, tutupan awan, dan sirkulasi angin monsun) bertindak sebagai daya pemulih alami.
          </p>
          <p>
            Model **Ornstein-Uhlenbeck** memformulasikan perilaku ini melalui persamaan diferensial stokastik: 
            <span className="font-mono block my-1 text-slate-900 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 p-1.5 rounded text-[11px] overflow-x-auto text-center">
              dXₜ = &theta;(&mu; - Xₜ)dt + &sigma;dWₜ
            </span>
            Di mana <span className="font-semibold text-slate-900 dark:text-white">&mu; (Jangkar Gravitasi)</span> adalah suhu rata-rata jangka panjang bulanan (titik ekuilibrium klimatologi), dan <span className="font-semibold text-slate-900 dark:text-white">&sigma; (Volatilitas)</span> mewakili kebisingan harian cuaca ekstrem. Parameter <span className="font-semibold text-slate-900 dark:text-white">&theta;</span> adalah kecepatan tarikan gravitasi: jika suhu menyimpang jauh dari jangkar &mu;, model ini memprediksi kecenderungan kuat untuk berangsur kembali (*mean revert*) ke nilai jangkar tersebut.
          </p>
        </div>
      )}

      {/* Main Grid: Visualisasi + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recharts Area Chart */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Envelop Parameter Bulanan (&mu; &plusmn; 1&sigma;)
            </span>
            <span className="text-[10px] text-slate-500">
              *Klik area grafik untuk memilih bulan
            </span>
          </div>
          <div className="h-[200px] sm:h-[240px] w-full bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl p-2 border border-slate-100 dark:border-slate-800">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                onClick={(state) => {
                  if (state && typeof state.activeTooltipIndex === "number") {
                    setSelectedMonthIdx(state.activeTooltipIndex);
                  }
                }}
              >
                <defs>
                  <linearGradient id="envelopeColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                  onClick={(e) => {
                    const idx = OU_MONTHS.findIndex(m => m.shortMonth === e.value);
                    if (idx !== -1) setSelectedMonthIdx(idx);
                  }}
                  className="cursor-pointer"
                />
                <YAxis 
                  domain={[25, 36]} 
                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(30, 41, 59, 0.98)",
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: 10,
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-slate-800 text-[10px] space-y-1">
                          <p className="font-bold border-b border-slate-850 pb-1 text-slate-200">{data.fullName}</p>
                          <p className="flex justify-between gap-4">
                            <span>Jangkar (&mu;):</span> 
                            <span className="font-mono text-indigo-400 font-semibold">{data["Jangkar Gravitasi (\u03BC)"].toFixed(2)} °C</span>
                          </p>
                          <p className="flex justify-between gap-4">
                            <span>Batas Atas (+1&sigma;):</span> 
                            <span className="font-mono text-emerald-400">{data["Batas Atas (+1\u03C3)"].toFixed(2)} °C</span>
                          </p>
                          <p className="flex justify-between gap-4">
                            <span>Batas Bawah (-1&sigma;):</span> 
                            <span className="font-mono text-amber-400">{data["Batas Bawah (-1\u03C3)"].toFixed(2)} °C</span>
                          </p>
                          <p className="text-[9px] text-slate-400 pt-1 text-right italic font-normal">Klik untuk info detil</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Volatility range envelope */}
                <Area
                  type="monotone"
                  dataKey="Batas Atas (+1\u03C3)"
                  stroke="none"
                  fill="url(#envelopeColor)"
                  className="cursor-pointer"
                />
                <Area
                  type="monotone"
                  dataKey="Batas Bawah (-1\u03C3)"
                  stroke="none"
                  fill="none"
                  className="cursor-pointer"
                />
                {/* Gravity Anchor Line */}
                <Line
                  type="monotone"
                  dataKey="Jangkar Gravitasi (\u03BC)"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#6366f1", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#e0e7ff", stroke: "#4f46e5", strokeWidth: 2 }}
                  className="cursor-pointer"
                />
                {/* Visual marker line for selected month */}
                <ReferenceLine 
                  x={OU_MONTHS[selectedMonthIdx].shortMonth} 
                  stroke="rgba(99, 102, 241, 0.45)" 
                  strokeDasharray="3 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            Garis biru = Jangkar Gravitasi (&mu;) · Area ungu berbayang = Rentang Normal Fluktuasi (&mu; &plusmn; 1&sigma;)
          </p>
        </div>

        {/* Selected Month Detail Card */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 sm:p-5 gap-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-1.5">
                <Calendar size={15} className="text-indigo-500" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Detail: {selectedData.month}
                </span>
              </div>
              {selectedMonthIdx === currentMonthIdx && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-500/20">
                  Bulan Aktif
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Jangkar Gravitasi (&mu;)</span>
                <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {selectedData.mean.toFixed(2)} °C
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Volatilitas (&sigma;)</span>
                <span className="text-base font-extrabold text-slate-600 dark:text-slate-300 mt-0.5">
                  &plusmn;{selectedData.sigma.toFixed(2)} °C
                </span>
              </div>
              <div className="col-span-2 bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Rentang Normal (&mu; &plusmn; 1&sigma;)</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                  {selectedData.minRange.toFixed(2)} – {selectedData.maxRange.toFixed(2)} °C
                </span>
              </div>
            </div>

            <div className="space-y-1 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Keterangan Musim</span>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {selectedData.season}
              </p>
            </div>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-805 pt-3">
            <button
              onClick={() => setSelectedMonthIdx((prev) => (prev === 0 ? 11 : prev - 1))}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              &larr; Prev
            </button>
            <span className="text-[10px] text-slate-400 font-mono">
              {selectedMonthIdx + 1} / 12
            </span>
            <button
              onClick={() => setSelectedMonthIdx((prev) => (prev === 11 ? 0 : prev + 1))}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Live Forecast Mean Reversion Deviation Analysis */}
      {deviationAnalysis && referenceTemp != null && (
        <div className="bg-slate-50/70 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Analisis Deviasi Mean Reversion Real-Time ({activeMonthData.month})
            </span>
          </div>

          {/* ── Data Quality Indicator ── */}
          {tempEstimate && (
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              {/* Source badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${
                tempEstimate.source === "OBSERVED"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  : "bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800"
              }`}>
                {tempEstimate.source === "OBSERVED" ? "✓ OBSERVASI" : "~ ESTIMASI DIURNAL"}
              </span>
              {/* Confidence badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold border ${
                tempEstimate.confidence === "HIGH"
                  ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                  : tempEstimate.confidence === "MED"
                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
              }`}>
                Kepercayaan: {tempEstimate.confidence}
              </span>
              {/* Stats */}
              <span className="text-slate-400 font-mono">
                {tempEstimate.currentHourSGT.toString().padStart(2,"0")}:00 SGT
                {" · "}
                {tempEstimate.dataQuality.valid}/{tempEstimate.dataQuality.total} obs valid
                {tempEstimate.dataQuality.removed > 0 && (
                  <span className="text-rose-400 ml-1">(−{tempEstimate.dataQuality.removed} QC)</span>
                )}
              </span>
              {/* Peak status */}
              <span className={`font-semibold ${
                tempEstimate.isPeakReached ? "text-emerald-500" : "text-amber-500"
              }`}>
                {tempEstimate.isPeakReached ? "✓ Puncak tercapai" : "⏳ Menuju puncak"}
              </span>
              {/* Correction note */}
              {tempEstimate.biasCorrection !== 0 && (
                <span className="text-slate-400">
                  Koreksi bias: {tempEstimate.biasCorrection > 0 ? "+" : ""}{tempEstimate.biasCorrection.toFixed(2)} °C
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Forecast vs Mean */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">
                  {isRealObs ? "Suhu Maks Riil (METAR)" : "Prakiraan Suhu Maks"}
                </span>
                <span className="text-lg font-extrabold text-slate-950 dark:text-white mt-1">
                  {referenceTemp.toFixed(1)} °C
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800 pt-1 flex items-center justify-between">
                <span>Sumber:</span>
                <span className="font-semibold text-indigo-500 dark:text-indigo-400">
                  {isRealObs ? "Sensor Bandara" : "Model ECMWF"}
                </span>
              </span>
            </div>

            {/* Deviation from Gravitational Anchor */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Deviasi dari Jangkar</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-lg font-extrabold ${deviationAnalysis.isAbove ? 'text-amber-500' : 'text-blue-550'}`}>
                    {deviationAnalysis.deviation > 0 ? "+" : ""}
                    {deviationAnalysis.deviation.toFixed(2)} °C
                  </span>
                  {deviationAnalysis.deviation !== 0 && (
                    deviationAnalysis.isAbove ? (
                      <TrendingUp size={16} className="text-amber-500" />
                    ) : (
                      <TrendingDown size={16} className="text-blue-550" />
                    )
                  )}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">
                Jangkar &mu; = {activeMonthData.mean.toFixed(2)} °C
              </span>
            </div>

            {/* Ornstein-Uhlenbeck Vector Force */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Gaya Tarik OU (H+1)</span>
                <span className="text-lg font-extrabold text-indigo-500 dark:text-indigo-400 block mt-1">
                  -{deviationAnalysis.correctionNextDay.toFixed(2)} °C / hari
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">
                Est. Esok: {deviationAnalysis.expectedTempNextDay.toFixed(1)} °C
              </span>
            </div>
          </div>

          <div className="text-xs bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-slate-805 rounded-xl p-3 leading-relaxed text-slate-500 dark:text-slate-400">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mb-1">
              <Target size={13} /> Analisis Prediktif OU
            </span>
            Suhu {isRealObs ? "maksimum riil hari ini berdasarkan METAR" : "prakiraan hari ini"} ({referenceTemp.toFixed(1)} °C) menyimpang sebesar{" "}
            <strong>
              {deviationAnalysis.deviation > 0 ? "+" : ""}
              {deviationAnalysis.deviation.toFixed(2)} °C
            </strong>{" "}
            dari jangkar gravitasi klimatologi bulan {activeMonthData.month} ({activeMonthData.mean.toFixed(2)} °C). 
            Dengan kecenderungan *mean reversion* (daya tarik atmosferik), model OU memproyeksikan suhu esok hari cenderung bergerak{" "}
            <strong>
              {deviationAnalysis.isAbove ? "turun" : "naik"}{" "}
              {Math.abs(deviationAnalysis.correctionNextDay).toFixed(2)} °C
            </strong>{" "}
            ke arah kesetimbangannya, menyeimbangkan anomali cuaca lokal jangka pendek.
          </div>
        </div>
      )}

      {/* ── SECTION: Probabilistic Forecast Tomorrow ── */}
      {probabilisticForecast && referenceTemp != null && (
        <div className="border border-indigo-100/60 dark:border-indigo-900/30 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl p-4 sm:p-5 space-y-4">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 rounded-xl">
                <BarChart2 size={15} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Prediksi Probabilistik Suhu Besok (H+1)
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold">
              &theta; = {theta} · Model OU Analitik
            </span>
          </div>

          {/* Expected Temp + Std */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {([
              { label: "P10 (Dingin)",  val: probabilisticForecast.percentiles.p10,  cls: "text-blue-600 dark:text-blue-400" },
              { label: "P25",           val: probabilisticForecast.percentiles.p25,  cls: "text-sky-600 dark:text-sky-400" },
              { label: "P50 (Median)",  val: probabilisticForecast.percentiles.p50,  cls: "text-indigo-600 dark:text-indigo-400 font-extrabold" },
              { label: "P75",           val: probabilisticForecast.percentiles.p75,  cls: "text-amber-500" },
              { label: "P90 (Panas)",   val: probabilisticForecast.percentiles.p90,  cls: "text-rose-500" },
              { label: "E[T] OU Mean",  val: probabilisticForecast.mean,             cls: "text-violet-600 dark:text-violet-400" },
              { label: "±σ Pred",        val: probabilisticForecast.std,              cls: "text-slate-500" },
              { label: "Sumber Sekarang", val: referenceTemp,                         cls: "text-slate-600 dark:text-slate-300" },
            ] as const).map(({ label, val, cls }) => (
              <div key={label} className="bg-white/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
                <span className={`text-sm font-bold mt-0.5 ${cls}`}>{val.toFixed(1)} °C</span>
              </div>
            ))}
          </div>

          {/* Gradient Temperature Bar */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Rentang Distribusi Probabilitas Besok</span>
            <div className="relative h-8 rounded-full overflow-hidden shadow-inner bg-gradient-to-r from-blue-400 via-indigo-400 via-violet-400 to-rose-400">
              {/* Median marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md"
                style={{
                  left: `${
                    ((probabilisticForecast.mean - probabilisticForecast.percentiles.p5) /
                      (probabilisticForecast.percentiles.p95 - probabilisticForecast.percentiles.p5)) *
                    100
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 font-mono px-1">
              <span>P5 {probabilisticForecast.percentiles.p5.toFixed(1)}°C</span>
              <span className="font-bold text-indigo-500">P50 {probabilisticForecast.percentiles.p50.toFixed(1)}°C</span>
              <span>P95 {probabilisticForecast.percentiles.p95.toFixed(1)}°C</span>
            </div>
          </div>

          {/* Threshold Probability Table */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
              <Zap size={11} className="text-amber-500" />
              Peluang Melewati Ambang Batas Suhu
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left py-1.5 px-2 text-slate-400 font-semibold text-[10px] uppercase">Ambang</th>
                    <th className="text-right py-1.5 px-2 text-slate-400 font-semibold text-[10px] uppercase">P(T &gt; X)</th>
                    <th className="text-right py-1.5 px-2 text-slate-400 font-semibold text-[10px] uppercase">P(T &le; X)</th>
                    <th className="py-1.5 px-2 w-28"><span className="sr-only">Bar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {probabilisticForecast.thresholds.map(({ temp, probAbove, probBelow }) => (
                    <tr key={temp} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/15 transition-colors">
                      <td className="py-1.5 px-2 font-mono font-bold text-slate-700 dark:text-slate-200">{temp}°C</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold ${
                        probAbove > 60 ? "text-rose-500" : probAbove > 30 ? "text-amber-500" : "text-slate-400"
                      }`}>{probAbove.toFixed(1)}%</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold ${
                        probBelow > 60 ? "text-blue-500" : probBelow > 30 ? "text-sky-500" : "text-slate-400"
                      }`}>{probBelow.toFixed(1)}%</td>
                      <td className="py-1.5 px-2">
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-500"
                            style={{ width: `${probAbove.toFixed(0)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            <span className="font-bold text-indigo-500">Catatan metodologi:</span>{" "}
            Prediksi probabilistik dihitung menggunakan distribusi Normal kondisional dari proses Ornstein-Uhlenbeck (OU).
            E[T<sub>t+1</sub>] = &mu; + (T<sub>t</sub> - &mu;)·e<sup>-&theta;</sup> ;&nbsp;
            &sigma;<sub>pred</sub> = &sigma;·&radic;((1 - e<sup>-2&theta;</sup>) / 2&theta;).
            Asumsi: &theta; = {theta}, sumber T<sub>t</sub> = {isRealObs ? "suhu maks riil METAR" : "prakiraan ECMWF"}.
          </p>
        </div>
      )}

      {/* Complete Table of OU Parameters */}
      <div className="space-y-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Tabel Titik Mean Reversion (Ornstein-Uhlenbeck Parameter)
        </span>
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400 border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-[10px] text-slate-550 dark:text-slate-400 uppercase font-semibold">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-3.5 py-3">Bulan</th>
                <th className="px-3.5 py-3 text-right">Jangkar Gravitasi (&mu;)</th>
                <th className="px-3.5 py-3 text-right">Volatilitas (&sigma;)</th>
                <th className="px-3.5 py-3 text-center">Rentang Normal (&mu; &plusmn; 1&sigma;)</th>
                <th className="px-3.5 py-3">Keterangan Musim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {OU_MONTHS.map((d, index) => {
                const isCurrent = index === currentMonthIdx;
                const isSelected = index === selectedMonthIdx;
                
                return (
                  <tr
                    key={d.month}
                    onClick={() => setSelectedMonthIdx(index)}
                    className={`cursor-pointer transition-colors duration-150 ${
                      isCurrent
                        ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 font-semibold"
                        : isSelected
                        ? "bg-slate-50 dark:bg-slate-800/45 text-slate-900 dark:text-white"
                        : "hover:bg-slate-50/55 dark:hover:bg-slate-800/25"
                    }`}
                  >
                    <td className="px-3.5 py-2.5 flex items-center gap-1.5">
                      {d.month}
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="Bulan Aktif" />
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-[11px]">
                      {d.mean.toFixed(2)} °C
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      &plusmn;{d.sigma.toFixed(2)} °C
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-mono text-[11px] text-slate-500 dark:text-slate-300">
                      {d.minRange.toFixed(2)} – {d.maxRange.toFixed(2)} °C
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 dark:text-slate-400 text-[11px] font-normal">
                      <div className="flex items-center justify-between gap-2">
                        <span>{d.season}</span>
                        {isSelected && (
                          <ChevronRight size={14} className="text-slate-400 dark:text-slate-600" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
