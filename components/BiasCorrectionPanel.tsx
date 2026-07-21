"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { WeatherComparisonRow } from "@/services/weatherService";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart2,
  RefreshCcw,
  Info,
  Zap,
} from "lucide-react";
import initWasm, {
  linear_regression,
  bias_stats,
  compute_rolling_bias,
} from "@/public/wasm/wasm_predict";

interface BiasCorrectionPanelProps {
  data: WeatherComparisonRow[];
  todayForecastTemp: number | null;
  todayForecastWind: number | null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  sub,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 sm:p-4 flex flex-col gap-1">
      <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider">
        {label}
      </span>
      <span className={`text-lg sm:text-2xl font-bold ${color}`}>
        {value > 0 ? "+" : ""}
        {value.toFixed(2)}
        <span className="text-xs sm:text-sm font-normal ml-1 text-slate-400">{unit}</span>
      </span>
      {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
}

function BiasDirectionBadge({ mbe }: { mbe: number }) {
  if (Math.abs(mbe) < 0.1)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
        <Minus size={12} /> Tidak ada bias sistematis
      </span>
    );
  if (mbe > 0)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
        <TrendingUp size={12} /> Model cenderung terlalu DINGIN (under-forecast)
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-xs font-semibold border border-rose-500/20">
      <TrendingDown size={12} /> Model cenderung terlalu PANAS (over-forecast)
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BiasCorrectionPanel({
  data,
  todayForecastTemp,
  todayForecastWind,
}: BiasCorrectionPanelProps) {
  const [metric, setMetric] = useState<"temp" | "wind">("temp");
  const [wasmReady, setWasmReady] = useState(false);

  useEffect(() => {
    initWasm({ module_or_path: "/wasm/wasm_predict_bg.wasm" })
      .then(() => {
        setWasmReady(true);
        console.log("Bias Correction WASM Engine initialized successfully.");
      })
      .catch((e) => {
        console.error("Failed to load Bias Correction WASM Engine:", e);
      });
  }, []);

  const validRows = useMemo(() => {
    return data.filter((r) => {
      if (metric === "temp")
        return r.actual_temp_max != null && r.forecast_temp_max != null;
      return r.actual_wind_max != null && r.forecast_wind_max != null;
    });
  }, [data, metric]);

  const actuals = useMemo(
    () =>
      validRows.map((r) =>
        metric === "temp" ? r.actual_temp_max : (r.actual_wind_max as number)
      ),
    [validRows, metric]
  );
  const forecasts = useMemo(
    () =>
      validRows.map((r) =>
        metric === "temp"
          ? r.forecast_temp_max
          : (r.forecast_wind_max as number)
      ),
    [validRows, metric]
  );

  // ── 1. Global Bias Stats
  const globalStats = useMemo(() => {
    if (!wasmReady || actuals.length === 0) {
      return { mbe: 0, mae: 0, rmse: 0, n: 0 };
    }
    return bias_stats(new Float64Array(actuals), new Float64Array(forecasts)) as { mbe: number; mae: number; rmse: number; n: number };
  }, [actuals, forecasts, wasmReady]);

  // ── 2. Linear Regression MOS
  const mos = useMemo(() => {
    if (!wasmReady || forecasts.length === 0) {
      return { a: 0, b: 1, r2: 0 };
    }
    return linear_regression(new Float64Array(forecasts), new Float64Array(actuals)) as { a: number; b: number; r2: number };
  }, [forecasts, actuals, wasmReady]);

  const scatterData = useMemo(
    () =>
      validRows.map((_, i) => ({
        forecast: parseFloat(forecasts[i].toFixed(1)),
        actual: parseFloat(actuals[i].toFixed(1)),
      })),
    [validRows, forecasts, actuals]
  );

  const [fMin, fMax] = useMemo(() => {
    if (forecasts.length === 0) return [0, 40];
    return [Math.min(...forecasts) - 1, Math.max(...forecasts) + 1];
  }, [forecasts]);

  const regressionLine = useMemo(
    () => [
      { forecast: fMin, actual: parseFloat((mos.a + mos.b * fMin).toFixed(2)) },
      { forecast: fMax, actual: parseFloat((mos.a + mos.b * fMax).toFixed(2)) },
    ],
    [fMin, fMax, mos]
  );

  // ── 3. Rolling Bias
  const rolling7 = useMemo(() => {
    if (!wasmReady || validRows.length === 0) {
      return { mbe: 0, mae: 0, rmse: 0, n: 0 };
    }
    const recent = validRows.slice(-7);
    const recentActuals = recent.map((r) =>
      metric === "temp" ? r.actual_temp_max : (r.actual_wind_max as number)
    );
    const recentForecasts = recent.map((r) =>
      metric === "temp"
        ? r.forecast_temp_max
        : (r.forecast_wind_max as number)
    );
    return bias_stats(new Float64Array(recentActuals), new Float64Array(recentForecasts)) as { mbe: number; mae: number; rmse: number; n: number };
  }, [validRows, metric, wasmReady]);

  const rolling30 = useMemo(() => {
    if (!wasmReady || validRows.length === 0) {
      return { mbe: 0, mae: 0, rmse: 0, n: 0 };
    }
    const recent = validRows.slice(-30);
    const recentActuals = recent.map((r) =>
      metric === "temp" ? r.actual_temp_max : (r.actual_wind_max as number)
    );
    const recentForecasts = recent.map((r) =>
      metric === "temp"
        ? r.forecast_temp_max
        : (r.forecast_wind_max as number)
    );
    return bias_stats(new Float64Array(recentActuals), new Float64Array(recentForecasts)) as { mbe: number; mae: number; rmse: number; n: number };
  }, [validRows, metric, wasmReady]);

  const rollingBiasChart = useMemo(() => {
    if (!wasmReady || validRows.length === 0) {
      return [];
    }
    const fullActuals = validRows.map((r) =>
      metric === "temp" ? r.actual_temp_max : (r.actual_wind_max as number)
    );
    const fullForecasts = validRows.map((r) =>
      metric === "temp"
        ? r.forecast_temp_max
        : (r.forecast_wind_max as number)
    );
    
    const limit = Math.min(validRows.length, 60);
    const entries = compute_rolling_bias(new Float64Array(fullActuals), new Float64Array(fullForecasts), limit) as Array<{ bias_7h: number; bias_30h: number }>;
    
    const recentRows = validRows.slice(-limit);
    return recentRows.map((row, i) => {
      const date = new Date(row.date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      });
      const entry = entries[i] || { bias_7h: 0, bias_30h: 0 };
      return {
        date,
        "Bias 7H": parseFloat(entry.bias_7h.toFixed(2)),
        "Bias 30H": parseFloat(entry.bias_30h.toFixed(2)),
      };
    });
  }, [validRows, metric, wasmReady]);

  const todayForecast = metric === "temp" ? todayForecastTemp : todayForecastWind;
  const unit = metric === "temp" ? "°C" : " km/j";

  const correctedMBE =
    todayForecast != null
      ? parseFloat((todayForecast + globalStats.mbe).toFixed(1))
      : null;
  const correctedMOS =
    todayForecast != null
      ? parseFloat((mos.a + mos.b * todayForecast).toFixed(1))
      : null;
  const correctedRolling7 =
    todayForecast != null
      ? parseFloat((todayForecast + rolling7.mbe).toFixed(1))
      : null;

  if (!wasmReady) {
    return (
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 text-slate-400 text-sm text-center flex flex-col items-center justify-center min-h-[300px] gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
        <span className="font-semibold text-slate-300">Menghubungkan Mesin Statistik WASM...</span>
      </div>
    );
  }

  if (validRows.length < 5) {
    return (
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 text-slate-400 text-sm text-center">
        <Info size={24} className="mx-auto mb-2 text-slate-600" />
        Data tidak cukup untuk analisis bias ({validRows.length} baris). Seed
        data historis terlebih dahulu.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-800 text-slate-100 w-full space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-500/10 rounded-2xl text-purple-400">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-1.5">
              Koreksi Bias Statistik Model
              <span className="text-[9px] font-extrabold font-mono text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full bg-purple-500/5 flex items-center gap-0.5">
                <Zap size={9} className="animate-pulse" />
                RUST WASM
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              MBE · Linear Regression MOS · Rolling Bias — WSSS Singapore
            </p>
          </div>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-slate-700 self-start sm:self-auto">
          <button
            onClick={() => setMetric("temp")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              metric === "temp"
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            Suhu Maks
          </button>
          <button
            onClick={() => setMetric("wind")}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              metric === "wind"
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            Angin Maks
          </button>
        </div>
      </div>

      {/* ── SECTION 1: Global Bias Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={14} className="text-purple-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            1 · Global Bias Correction (MBE)
          </span>
          <span className="text-[10px] text-slate-500">· {globalStats.n} hari data</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
          <StatCard
            label="MBE (Mean Bias)"
            value={globalStats.mbe}
            unit={unit}
            sub="Aktual − Prediksi"
            color={
              Math.abs(globalStats.mbe) < 0.3
                ? "text-emerald-400"
                : globalStats.mbe > 0
                ? "text-amber-400"
                : "text-rose-400"
            }
          />
          <StatCard
            label="MAE"
            value={globalStats.mae}
            unit={unit}
            sub="Rata-rata |Error|"
            color="text-blue-300"
          />
          <StatCard
            label="RMSE"
            value={globalStats.rmse}
            unit={unit}
            sub="Penalti error besar"
            color="text-indigo-300"
          />
        </div>
        <BiasDirectionBadge mbe={globalStats.mbe} />
      </div>

      {/* ── SECTION 2: Linear Regression MOS */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-sky-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            2 · Linear Regression MOS
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 sm:col-span-2">
            <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-bold">
              Persamaan Koreksi MOS
            </p>
            <p className="font-mono text-sm sm:text-base text-sky-300 font-semibold break-all">
              Corrected = {mos.a.toFixed(3)} + {mos.b.toFixed(3)} × ECMWF
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-slate-500">
                R² ={" "}
                <span
                  className={`font-bold ${
                    mos.r2 > 0.8
                      ? "text-emerald-400"
                      : mos.r2 > 0.5
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {(mos.r2 * 100).toFixed(1)}%
                </span>
                <span className="text-slate-600 ml-1">
                  (
                  {mos.r2 > 0.8
                    ? "Fit bagus"
                    : mos.r2 > 0.5
                    ? "Fit sedang"
                    : "Fit lemah"}
                  )
                </span>
              </span>
            </div>
          </div>
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
              Slope (b)
            </p>
            <p className="text-lg font-bold text-sky-300">{mos.b.toFixed(3)}</p>
            <p className="text-[10px] text-slate-500">
              {Math.abs(mos.b - 1) < 0.05
                ? "Proporsional ideal"
                : mos.b > 1
                ? "Model under-dispersed"
                : "Model over-dispersed"}
            </p>
          </div>
        </div>

        {/* Scatter Plot */}
        <div className="h-[200px] sm:h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 10, bottom: 20, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-800" />
              <XAxis
                type="number"
                dataKey="forecast"
                name="Prediksi ECMWF"
                tick={{ fontSize: 9, fill: "#94a3b8" }}
                label={{
                  value: `Prediksi ECMWF (${unit.trim()})`,
                  position: "insideBottom",
                  offset: -10,
                  fontSize: 9,
                  fill: "#64748b",
                }}
                domain={["auto", "auto"]}
              />
              <YAxis
                type="number"
                dataKey="actual"
                name="Aktual METAR"
                tick={{ fontSize: 9, fill: "#94a3b8" }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  backgroundColor: "rgba(15,23,42,0.95)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  fontSize: 11,
                  color: "#e2e8f0",
                }}
                formatter={(val, name) => [
                  `${val ?? ""}${unit}`,
                  name === "forecast" ? "Prediksi" : "Aktual",
                ]}
              />
              {/* Observed data points */}
              <Scatter data={scatterData} fill="#818cf8" fillOpacity={0.55} r={3} name="Observasi" />
              {/* Regression line */}
              <Scatter
                data={regressionLine}
                line={{ stroke: "#38bdf8", strokeWidth: 2 }}
                shape={() => null as unknown as React.ReactElement}
                fill="none"
                name="Garis Regresi MOS"
                legendType="line"
              />
              {/* Perfect forecast y=x */}
              <ReferenceLine
                segment={[
                  { x: fMin, y: fMin },
                  { x: fMax, y: fMax },
                ]}
                stroke="#475569"
                strokeDasharray="5 5"
                strokeWidth={1}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-slate-500 text-center mt-1">
          Ungu = data historis · Biru = garis regresi MOS · Abu putus-putus = prediksi sempurna (y=x)
        </p>
      </div>

      {/* ── SECTION 3: Rolling Bias */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <RefreshCcw size={14} className="text-teal-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            3 · Rolling Bias (7H & 30H Terakhir)
          </span>
        </div>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-3 text-slate-400 font-semibold">Metode</th>
                <th className="text-right py-2 px-3 text-slate-400 font-semibold">MBE</th>
                <th className="text-right py-2 px-3 text-slate-400 font-semibold">MAE</th>
                <th className="text-right py-2 px-3 text-slate-400 font-semibold">RMSE</th>
                <th className="text-right py-2 px-3 text-slate-400 font-semibold">N</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {[
                { label: "Global (Seluruh Data)", stats: globalStats, color: "text-purple-300" },
                { label: "Rolling 7 Hari Terakhir", stats: rolling7, color: "text-teal-300" },
                { label: "Rolling 30 Hari Terakhir", stats: rolling30, color: "text-sky-300" },
              ].map(({ label, stats, color }) => (
                <tr key={label} className="hover:bg-slate-800/30 transition-colors">
                  <td className={`py-2.5 px-3 font-medium ${color}`}>{label}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono font-semibold ${
                      stats.mbe > 0.3
                        ? "text-amber-400"
                        : stats.mbe < -0.3
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {stats.mbe > 0 ? "+" : ""}
                    {stats.mbe.toFixed(2)}
                    {unit}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                    {stats.mae.toFixed(2)}
                    {unit}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                    {stats.rmse.toFixed(2)}
                    {unit}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{stats.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rolling Bias Line Chart */}
        <div className="h-[180px] sm:h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rollingBiasChart}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-800" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#94a3b8" }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15,23,42,0.95)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  fontSize: 11,
                  color: "#e2e8f0",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(val: any) => [
                  `${val > 0 ? "+" : ""}${val}${unit}`,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "10px", color: "#94a3b8" }}
                verticalAlign="top"
                height={28}
              />
              <ReferenceLine
                y={0}
                stroke="#475569"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
              <Line
                type="monotone"
                dataKey="Bias 7H"
                stroke="#2dd4bf"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Bias 30H"
                stroke="#60a5fa"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-slate-500 text-center mt-1">
          Tren bias 60 hari terakhir · Garis putus-putus abu = nol (prediksi sempurna)
        </p>
      </div>

      {/* ── SECTION 4: Corrected Forecast Today */}
      {todayForecast != null && (
        <div className="border-t border-slate-800 pt-4 sm:pt-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Koreksi Prakiraan Hari Ini (H-0)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-slate-950/40 border border-slate-700 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">ECMWF Raw</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-200">
                {todayForecast.toFixed(1)}
                {unit}
              </p>
              <p className="text-[9px] text-slate-600 mt-0.5">Tanpa koreksi</p>
            </div>
            <div className="bg-purple-950/20 border border-purple-700/40 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-purple-400 uppercase tracking-wider mb-1">+ Koreksi MBE</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-300">
                {correctedMBE}
                {unit}
              </p>
              <p className="text-[9px] text-purple-600 mt-0.5">
                {globalStats.mbe > 0 ? "+" : ""}
                {globalStats.mbe.toFixed(2)} koreksi
              </p>
            </div>
            <div className="bg-sky-950/20 border border-sky-700/40 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-sky-400 uppercase tracking-wider mb-1">+ Koreksi MOS</p>
              <p className="text-xl sm:text-2xl font-bold text-sky-300">
                {correctedMOS}
                {unit}
              </p>
              <p className="text-[9px] text-sky-600 mt-0.5">
                Regresi linear (R²={(mos.r2 * 100).toFixed(0)}%)
              </p>
            </div>
            <div className="bg-teal-950/20 border border-teal-700/40 rounded-2xl p-3 text-center">
              <p className="text-[10px] text-teal-400 uppercase tracking-wider mb-1">+ Rolling 7H</p>
              <p className="text-xl sm:text-2xl font-bold text-teal-300">
                {correctedRolling7}
                {unit}
              </p>
              <p className="text-[9px] text-teal-600 mt-0.5">
                {rolling7.mbe > 0 ? "+" : ""}
                {rolling7.mbe.toFixed(2)} koreksi
              </p>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-3 text-center">
            Semua nilai di atas adalah estimasi statistik, bukan prediksi operasional resmi.
          </p>
        </div>
      )}
    </div>
  );
}
