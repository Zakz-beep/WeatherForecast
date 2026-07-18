"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { WeatherComparisonRow } from "@/services/weatherService";
import { Play, AlertCircle, CheckCircle2 } from "lucide-react";

interface History2026ChartProps {
  initialData: WeatherComparisonRow[];
  city: string;
}

export default function History2026Chart({ initialData, city }: History2026ChartProps) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<WeatherComparisonRow[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [dataType, setDataType] = useState<"temp" | "wind">("temp");
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setData(initialData);
  }, [initialData]);

  if (!mounted) {
    return <div className="h-[450px] w-full bg-slate-100 dark:bg-slate-900 rounded-3xl animate-pulse" />;
  }

  const handleSeedData = async () => {
    setLoading(true);
    setStatus({ type: null, message: "" });
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const result = await res.json();
      if (res.ok && result.success) {
        setStatus({ type: "success", message: `Berhasil menambahkan ${result.count} data cuaca 2026 ke Supabase!` });
        router.refresh();
      } else {
        setStatus({ type: "error", message: result.error || "Gagal mengunggah data." });
      }
    } catch (err) {
      console.error("Error seeding data:", err);
      setStatus({ type: "error", message: "Gagal menghubungkan ke server." });
    } finally {
      setLoading(false);
    }
  };

  const chartData = data.map((row) => {
    // Format date string "2026-05-15" to "15 Mei"
    const dateObj = new Date(row.date);
    const dateLabel = dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short"
    });
    return {
      date: dateLabel,
      "Aktual (METAR)": dataType === "temp" ? row.actual_temp_max : row.actual_wind_max,
      "Prediksi (Open-Meteo)": dataType === "temp" ? row.forecast_temp_max : row.forecast_wind_max
    };
  });

  const isDataEmpty = data.length === 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Analisis Komparatif Historis 2026 - {city}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Data aktual bandara vs prakiraan Open-Meteo sepanjang tahun 2026
          </p>
        </div>

        {!isDataEmpty && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setDataType("temp")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                dataType === "temp"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              Suhu Maks (°C)
            </button>
            <button
              onClick={() => setDataType("wind")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                dataType === "wind"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              Angin Maks (km/h)
            </button>
          </div>
        )}
      </div>

      {isDataEmpty ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-4">
          <AlertCircle size={40} className="text-slate-400 dark:text-slate-600" />
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">
              Data Supabase Kosong
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Belum ada data historis 2026 di tabel <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-pink-500">weather_comparison_2026</code>. Pastikan Anda telah membuat tabelnya melalui Supabase SQL Editor.
            </p>
          </div>

          <button
            onClick={handleSeedData}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-3 rounded-full text-sm font-semibold transition-all shadow-md shadow-blue-500/20"
          >
            {loading ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Play size={16} />
            )}
            <span>Masukkan Data Historis 2026 (Seed)</span>
          </button>
          
          {status.type && (
            <div className={`mt-2 flex items-center gap-2 text-xs p-3 rounded-xl ${
              status.type === "success" 
                ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400" 
                : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
            }`}>
              {status.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{status.message}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="h-[260px] sm:h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-slate-500 dark:fill-slate-400" />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} className="fill-slate-500 dark:fill-slate-400" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(30, 41, 59, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  dataKey="Prediksi (Open-Meteo)"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={false}
                  name={dataType === "temp" ? "Prediksi Suhu Maks (Open-Meteo)" : "Prediksi Angin Maks (Open-Meteo)"}
                />
                <Line
                  type="monotone"
                  dataKey="Aktual (METAR)"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  dot={false}
                  name={dataType === "temp" ? "Aktual Suhu Maks (METAR)" : "Aktual Angin Maks (METAR)"}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Table Container */}
          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Tabel Detail Perbandingan & Selisih
            </h4>
            <div className="max-h-64 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl shadow-inner">
              <table className="w-full text-left text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] sm:text-xs text-slate-700 dark:text-slate-300 uppercase sticky top-0 backdrop-blur-sm">
                  <tr>
                    <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3">Tanggal</th>
                    <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3">Prediksi</th>
                    <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3">Aktual</th>
                    <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3">Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.slice().reverse().map((row) => {
                    const dateObj = new Date(row.date);
                    const formattedDate = dateObj.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });
                    
                    const forecast = dataType === "temp" ? row.forecast_temp_max : row.forecast_wind_max;
                    const actual = dataType === "temp" ? row.actual_temp_max : row.actual_wind_max;
                    
                    let diff: string | number = "-";
                    let diffClass = "text-slate-500 dark:text-slate-400";
                    
                    if (actual !== null && forecast !== null) {
                      const val = parseFloat((actual - forecast).toFixed(1));
                      diff = val > 0 ? `+${val}` : `${val}`;
                      if (Math.abs(val) > 1.0) {
                        diffClass = "text-amber-600 dark:text-amber-400 font-medium";
                      } else {
                        diffClass = "text-emerald-600 dark:text-emerald-400 font-medium";
                      }
                    }
                    
                    const unit = dataType === "temp" ? "°C" : " km/j";

                    return (
                      <tr key={row.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900 transition-colors">
                        <td className="px-3 sm:px-6 py-2 sm:py-3 font-medium text-slate-900 dark:text-slate-200">{formattedDate}</td>
                        <td className="px-3 sm:px-6 py-2 sm:py-3">{forecast !== null ? `${forecast}${unit}` : "-"}</td>
                        <td className="px-3 sm:px-6 py-2 sm:py-3">{actual !== null ? `${actual}${unit}` : "-"}</td>
                        <td className={`px-3 sm:px-6 py-2 sm:py-3 ${diffClass}`}>
                          {diff !== "-" ? `${diff}${unit}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center mt-4">
            <button
              onClick={handleSeedData}
              disabled={loading}
              className="text-xs text-blue-500 dark:text-blue-400 hover:underline font-medium"
            >
              {loading ? "Menyegarkan data..." : "Perbarui/Unggah ulang data dari Open-Meteo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
