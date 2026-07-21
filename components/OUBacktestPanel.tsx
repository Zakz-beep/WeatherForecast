"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  Legend,
} from "recharts";
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle,
  AlertCircle,
  Info,
  BarChart2,
  Minus,
  Award,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import type {
  BacktestRow,
  BacktestMetrics,
  RollingWindowEntry,
} from "@/lib/ouBacktest";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OUBacktestPanelProps {
  rows: BacktestRow[];
  metrics: BacktestMetrics | null;
  rolling: RollingWindowEntry[];
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

interface ErrorBarTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: BacktestRow;
  }>;
}

function ErrorBarTooltip({ active, payload }: ErrorBarTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-[11px] space-y-1.5 min-w-[200px]">
      <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">
        {row.targetDate}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-slate-400">Prediksi OU:</span>
        <span className="font-mono font-semibold text-indigo-400">
          {row.predictedTemp.toFixed(2)}°C
        </span>
        <span className="text-slate-400">Suhu Aktual:</span>
        <span className="font-mono font-semibold text-emerald-400">
          {row.actualTemp.toFixed(2)}°C
        </span>
        <span className="text-slate-400">Error:</span>
        <span
          className={`font-mono font-semibold ${
            row.error > 0 ? "text-amber-400" : "text-sky-400"
          }`}
        >
          {row.error > 0 ? "+" : ""}
          {row.error.toFixed(2)}°C
        </span>
        <span className="text-slate-400">|Error|:</span>
        <span className="font-mono text-slate-300">{row.absError.toFixed(2)}°C</span>
      </div>
      {row.regime && (
        <p className="text-[10px] text-slate-500 pt-0.5 border-t border-slate-800">
          Regime: {row.regime}
        </p>
      )}
      <p
        className={`text-[10px] font-semibold pt-0.5 ${
          row.withinOne
            ? "text-emerald-400"
            : row.withinTwo
            ? "text-amber-400"
            : "text-rose-400"
        }`}
      >
        {row.withinOne ? "✓ Dalam ±1°C" : row.withinTwo ? "~ Dalam ±2°C" : "✗ Di luar ±2°C"}
      </p>
    </div>
  );
}

interface RollingTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: RollingWindowEntry;
  }>;
}

function RollingTooltip({ active, payload }: RollingTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-[11px] space-y-1.5">
      <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">{d.date}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-slate-400">Rolling RMSE:</span>
        <span className="font-mono text-rose-400 font-semibold">{d.rmse.toFixed(3)}°C</span>
        <span className="text-slate-400">Rolling MAE:</span>
        <span className="font-mono text-amber-400 font-semibold">{d.mae.toFixed(3)}°C</span>
        <span className="text-slate-400">Window (n):</span>
        <span className="font-mono text-slate-300">{d.n} hari</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OUBacktestPanel({ rows, metrics, rolling }: OUBacktestPanelProps) {
  const [showChart, setShowChart] = useState<"error" | "rolling">("error");
  const [showDetail, setShowDetail] = useState(false);

  // Slice last N rows for chart readability
  const CHART_LIMIT = 60;
  const chartRows = useMemo(
    () => rows.slice(-CHART_LIMIT).map((r) => ({
      ...r,
      // Recharts needs numeric domain — use short date label
      label: r.targetDate.slice(5), // "MM-DD"
    })),
    [rows]
  );
  const rollingChart = useMemo(() => rolling.slice(-CHART_LIMIT).map(r => ({
    ...r,
    label: r.date.slice(5),
  })), [rolling]);

  const hasData = rows.length > 0 && metrics !== null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors w-full space-y-5 text-slate-800 dark:text-slate-100">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-violet-500/10 rounded-2xl text-violet-600 dark:text-violet-400">
            <FlaskConical size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Backtesting &amp; Accuracy Score
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluasi akurasi prediksi OU H+1 vs suhu aktual — WSSS Singapore
            </p>
          </div>
        </div>
        {metrics && (
          <div
            className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${metrics.ratingBg} ${metrics.ratingColor} ${metrics.ratingBorder}`}
          >
            <Award size={13} />
            {metrics.ratingLabel}
          </div>
        )}
      </div>

      {/* ── No data state ── */}
      {!hasData && (
        <div className="py-10 flex flex-col items-center gap-3 text-slate-400">
          <FlaskConical size={32} className="opacity-30" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Belum Ada Data Backtesting
          </p>
          <p className="text-xs text-center max-w-xs text-slate-400 leading-relaxed">
            Data akan mulai terakumulasi setelah model OU berjalan minimal 1 hari.
            Prediksi harian disimpan otomatis ke Supabase setiap kali halaman Singapore dibuka.
          </p>
          <div className="mt-2 px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-[11px] text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1">
            <Info size={11} />
            Buka halaman ini lagi besok untuk melihat hasil pertama
          </div>
        </div>
      )}

      {/* ── Metrics Cards ── */}
      {hasData && metrics && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {([
              {
                label: "RMSE",
                value: `${metrics.rmse.toFixed(2)}°C`,
                sub: "Root Mean Sq. Error",
                icon: <Target size={14} />,
                color: metrics.rmse < 0.8 ? "text-emerald-500" : metrics.rmse < 1.5 ? "text-sky-500" : metrics.rmse < 2.5 ? "text-amber-500" : "text-rose-500",
              },
              {
                label: "MAE",
                value: `${metrics.mae.toFixed(2)}°C`,
                sub: "Mean Absolute Error",
                icon: <Minus size={14} />,
                color: "text-indigo-500 dark:text-indigo-400",
              },
              {
                label: "MAPE",
                value: `${metrics.mape.toFixed(2)}%`,
                sub: "Mean % Error",
                icon: <BarChart2 size={14} />,
                color: "text-violet-500 dark:text-violet-400",
              },
              {
                label: "Hit ±1°C",
                value: `${metrics.hitRate1.toFixed(0)}%`,
                sub: `${rows.filter((r) => r.withinOne).length}/${metrics.n} hari`,
                icon: <CheckCircle size={14} />,
                color: metrics.hitRate1 >= 70 ? "text-emerald-500" : metrics.hitRate1 >= 50 ? "text-amber-500" : "text-rose-500",
              },
              {
                label: "Hit ±2°C",
                value: `${metrics.hitRate2.toFixed(0)}%`,
                sub: `${rows.filter((r) => r.withinTwo).length}/${metrics.n} hari`,
                icon: <CheckCircle size={14} />,
                color: metrics.hitRate2 >= 85 ? "text-emerald-500" : "text-amber-500",
              },
              {
                label: "Bias",
                value: `${metrics.meanBias > 0 ? "+" : ""}${metrics.meanBias.toFixed(2)}°C`,
                sub: metrics.meanBias > 0.1 ? "Model terlalu rendah" : metrics.meanBias < -0.1 ? "Model terlalu tinggi" : "Bias rendah ✓",
                icon: metrics.meanBias > 0.1 ? <TrendingUp size={14} /> : metrics.meanBias < -0.1 ? <TrendingDown size={14} /> : <CheckCircle size={14} />,
                color: Math.abs(metrics.meanBias) < 0.2 ? "text-emerald-500" : "text-amber-500",
              },
            ] as const).map(({ label, value, sub, icon, color }) => (
              <div
                key={label}
                className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 flex flex-col gap-1"
              >
                <div className={`flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide`}>
                  {icon}
                  {label}
                </div>
                <span className={`text-lg font-black font-mono ${color}`}>{value}</span>
                <span className="text-[10px] text-slate-400 leading-tight">{sub}</span>
              </div>
            ))}
          </div>

          {/* ── Sample size badge ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Sampel
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 text-[11px] font-bold">
              n = {metrics.n} hari
            </span>
            <span className="text-[10px] text-slate-400">
              ({rows[0]?.targetDate} → {rows[rows.length - 1]?.targetDate})
            </span>
          </div>

          {/* ── Chart Toggle ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Visualisasi
              </span>
              <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
                <button
                  onClick={() => setShowChart("error")}
                  className={`px-3 py-1 transition-colors ${
                    showChart === "error"
                      ? "bg-violet-500 text-white"
                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  Error Harian
                </button>
                <button
                  onClick={() => setShowChart("rolling")}
                  className={`px-3 py-1 transition-colors ${
                    showChart === "rolling"
                      ? "bg-violet-500 text-white"
                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  Rolling RMSE
                </button>
              </div>
            </div>

            {/* Error Bar Chart */}
            {showChart === "error" && (
              <div className="h-[220px] w-full bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl p-2 border border-slate-100 dark:border-slate-800">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartRows}
                    margin={{ top: 10, right: 8, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 8, fill: "#94a3b8" }}
                      interval={Math.floor(chartRows.length / 8)}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "#94a3b8" }}
                      tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
                    />
                    <Tooltip content={<ErrorBarTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" />
                    <ReferenceLine y={1} stroke="rgba(34,197,94,0.25)" strokeDasharray="3 3" />
                    <ReferenceLine y={-1} stroke="rgba(34,197,94,0.25)" strokeDasharray="3 3" />
                    <ReferenceLine y={2} stroke="rgba(245,158,11,0.2)" strokeDasharray="2 4" />
                    <ReferenceLine y={-2} stroke="rgba(245,158,11,0.2)" strokeDasharray="2 4" />
                    <Bar
                      dataKey="error"
                      name="Error (Aktual − Prediksi)"
                      fill="#8b5cf6"
                      radius={[2, 2, 0, 0]}
                      // Color each bar: positive=amber(under-predict), negative=sky(over-predict)
                      label={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-center text-slate-400 mt-1">
                  Bar hijau = dalam ±1°C · garis putus = batas ±1°C dan ±2°C
                </p>
              </div>
            )}

            {/* Rolling RMSE/MAE Line Chart */}
            {showChart === "rolling" && (
              <div className="h-[220px] w-full bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl p-2 border border-slate-100 dark:border-slate-800">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={rollingChart}
                    margin={{ top: 10, right: 8, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="rmseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 8, fill: "#94a3b8" }}
                      interval={Math.floor(rollingChart.length / 8)}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "#94a3b8" }}
                      domain={[0, "auto"]}
                      tickFormatter={(v) => `${v.toFixed(1)}`}
                    />
                    <Tooltip content={<RollingTooltip />} />
                    <ReferenceLine y={0.8} stroke="rgba(34,197,94,0.3)" strokeDasharray="3 3" label={{ value: "Excellent", fontSize: 8, fill: "#22c55e", position: "right" }} />
                    <ReferenceLine y={1.5} stroke="rgba(245,158,11,0.3)" strokeDasharray="3 3" label={{ value: "Fair", fontSize: 8, fill: "#f59e0b", position: "right" }} />
                    <Area
                      type="monotone"
                      dataKey="rmse"
                      name="Rolling RMSE"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fill="url(#rmseGrad)"
                    />
                    <Line
                      type="monotone"
                      dataKey="mae"
                      name="Rolling MAE"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4 2"
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "9px", paddingTop: "4px" }}
                      formatter={(v) => <span className="text-slate-500">{v}</span>}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-center text-slate-400 mt-1">
                  Rolling 30-hari · garis hijau = threshold Excellent (&lt;0.8°C) · garis kuning = Fair (&lt;1.5°C)
                </p>
              </div>
            )}
          </div>

          {/* ── Detail Table (Collapsible) ── */}
          <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors text-left"
            >
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Tabel Detail Per Hari ({rows.length} entri)
              </span>
              {showDetail ? (
                <ChevronUp size={14} className="text-slate-400" />
              ) : (
                <ChevronDown size={14} className="text-slate-400" />
              )}
            </button>

            {showDetail && (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Tanggal</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Prediksi</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Aktual</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Error</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">|Error|</th>
                      <th className="text-center px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {[...rows].reverse().map((r) => (
                      <tr key={r.targetDate} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">{r.targetDate}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-indigo-500 dark:text-indigo-400 text-[11px]">{r.predictedTemp.toFixed(2)}°C</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-500 text-[11px]">{r.actualTemp.toFixed(2)}°C</td>
                        <td className={`px-3 py-2 text-right font-mono text-[11px] ${r.error > 0 ? "text-amber-500" : "text-sky-500"}`}>
                          {r.error > 0 ? "+" : ""}{r.error.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400">{r.absError.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          {r.withinOne ? (
                            <CheckCircle size={12} className="text-emerald-500 mx-auto" />
                          ) : r.withinTwo ? (
                            <AlertCircle size={12} className="text-amber-500 mx-auto" />
                          ) : (
                            <AlertCircle size={12} className="text-rose-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Methodology note ── */}
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <span className="font-bold text-violet-500">Metodologi backtesting:</span>{" "}
            Prediksi OU P50 H+1 yang dibuat pada hari T dibandingkan dengan suhu maksimum riil METAR
            pada hari T+1 (dari tabel <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">weather_comparison_2026</code>).
            RMSE &lt; 0.8°C = Excellent · &lt; 1.5°C = Good · &lt; 2.5°C = Fair · ≥ 2.5°C = Poor.
            Rolling window: 30 hari terakhir.
          </p>
        </>
      )}
    </div>
  );
}
