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
} from "lucide-react";

interface OUMeanReversionPanelProps {
  todayForecastTemp: number | null;
}

interface MonthData {
  month: string;
  shortMonth: string;
  mean: number;
  sigma: number;
  minRange: number;
  maxRange: number;
  season: string;
}

const MONTHS_DATA: MonthData[] = [
  { month: "Januari", shortMonth: "Jan", mean: 29.48, sigma: 1.91, minRange: 27.57, maxRange: 31.39, season: "Monsun Timur Laut (Basah & Dingin)" },
  { month: "Februari", shortMonth: "Feb", mean: 31.00, sigma: 1.25, minRange: 29.75, maxRange: 32.25, season: "Transisi (Mulai Kering)" },
  { month: "Maret", shortMonth: "Mar", mean: 31.26, sigma: 2.03, minRange: 29.23, maxRange: 33.29, season: "Transisi (Volatilitas Tinggi)" },
  { month: "April", shortMonth: "Apr", mean: 32.04, sigma: 1.49, minRange: 30.55, maxRange: 33.53, season: "Periode Equinox (Panas)" },
  { month: "Mei", shortMonth: "Mei", mean: 32.06, sigma: 1.17, minRange: 30.89, maxRange: 33.23, season: "Awal Monsun Barat Daya (Panas)" },
  { month: "Juni", shortMonth: "Jun", mean: 31.74, sigma: 1.14, minRange: 30.60, maxRange: 32.88, season: "Monsun Barat Daya (Stabil Panas)" },
  { month: "Juli", shortMonth: "Jul", mean: 31.56, sigma: 1.18, minRange: 30.38, maxRange: 32.74, season: "Tengah Tahun (Stabil/Jinak)" },
  { month: "Agustus", shortMonth: "Agu", mean: 31.35, sigma: 1.13, minRange: 30.22, maxRange: 32.48, season: "Tengah Tahun (Stabil/Jinak)" },
  { month: "September", shortMonth: "Sep", mean: 31.34, sigma: 1.29, minRange: 30.05, maxRange: 32.63, season: "Transisi" },
  { month: "Oktober", shortMonth: "Okt", mean: 32.02, sigma: 1.33, minRange: 30.69, maxRange: 33.35, season: "Transisi Volatil (Mulai Basah)" },
  { month: "November", shortMonth: "Nov", mean: 31.44, sigma: 1.36, minRange: 30.08, maxRange: 32.80, season: "Awal Monsun Timur Laut (Mulai Dingin)" },
  { month: "Desember", shortMonth: "Des", mean: 30.71, sigma: 1.49, minRange: 29.22, maxRange: 32.20, season: "Monsun Timur Laut (Basah & Dingin)" }
];

export default function OUMeanReversionPanel({ todayForecastTemp }: OUMeanReversionPanelProps) {
  // Dapatkan bulan berjalan secara otomatis (0-11)
  const currentMonthIdx = useMemo(() => new Date().getMonth(), []);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(currentMonthIdx);
  const [showExplanation, setShowExplanation] = useState(false);

  const selectedData = MONTHS_DATA[selectedMonthIdx];
  const activeMonthData = MONTHS_DATA[currentMonthIdx];

  // Hitung analisis deviasi jika forecast hari ini tersedia
  const deviationAnalysis = useMemo(() => {
    if (todayForecastTemp == null) return null;
    
    // Bandingkan forecast dengan jangkar gravitasi bulan ini (activeMonthData.mean)
    const deviation = todayForecastTemp - activeMonthData.mean;
    const absDev = Math.abs(deviation);
    
    // Kecepatan reversion teoritis untuk suhu harian Singapura (diperkirakan ~0.25 / hari)
    const theta = 0.25; 
    const correctionNextDay = deviation * theta;
    const expectedTempNextDay = todayForecastTemp - correctionNextDay;

    return {
      deviation,
      absDev,
      correctionNextDay,
      expectedTempNextDay,
      isAbove: deviation > 0,
      isWithinVol: absDev <= activeMonthData.sigma,
    };
  }, [todayForecastTemp, activeMonthData]);

  // Persiapkan data untuk chart Recharts
  const chartData = useMemo(() => {
    return MONTHS_DATA.map((d, index) => ({
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
                    const idx = MONTHS_DATA.findIndex(m => m.shortMonth === e.value);
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
                  x={MONTHS_DATA[selectedMonthIdx].shortMonth} 
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
      {deviationAnalysis && todayForecastTemp != null && (
        <div className="bg-slate-50/70 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Analisis Deviasi Mean Reversion Real-Time ({activeMonthData.month})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Forecast vs Mean */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Prakiraan Hari Ini</span>
                <span className="text-lg font-extrabold text-slate-950 dark:text-white mt-1">
                  {todayForecastTemp.toFixed(1)} °C
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2">
                ECMWF Max Temp H-0
              </span>
            </div>

            {/* Deviation from Gravitational Anchor */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Deviasi dari Jangkar</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-lg font-extrabold ${deviationAnalysis.isAbove ? 'text-amber-500' : 'text-blue-505'}`}>
                    {deviationAnalysis.deviation > 0 ? "+" : ""}
                    {deviationAnalysis.deviation.toFixed(2)} °C
                  </span>
                  {deviationAnalysis.deviation !== 0 && (
                    deviationAnalysis.isAbove ? (
                      <TrendingUp size={16} className="text-amber-500" />
                    ) : (
                      <TrendingDown size={16} className="text-blue-505" />
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
            Suhu prakiraan hari ini ({todayForecastTemp.toFixed(1)} °C) menyimpang sebesar{" "}
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
              {MONTHS_DATA.map((d, index) => {
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
