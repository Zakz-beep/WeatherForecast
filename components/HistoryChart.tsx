"use client";

import { useEffect, useState } from "react";
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
import { HourlyForecastData } from "@/services/weatherService";
import { MetarData } from "@/services/metarService";

interface HistoryChartProps {
  ecmwfHistory: HourlyForecastData;
  metarHistory: MetarData[];
  stationName: string;
}

export default function HistoryChart({ ecmwfHistory, metarHistory, stationName }: HistoryChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[400px] w-full bg-slate-100 dark:bg-slate-900 rounded-3xl animate-pulse" />;
  }

  // Map METAR temperatures by their rounded hourly timestamp (UTC)
  // METAR time format: "2026-07-18T10:30:00.000Z" -> round to nearest hour or match by prefix
  const metarMap = new Map<string, number>();
  metarHistory.forEach((obs) => {
    if (obs.reportTime) {
      // e.g. "2026-07-18T10:30:00.000Z" -> "2026-07-18T10"
      const hourKey = obs.reportTime.substring(0, 13);
      metarMap.set(hourKey, obs.temp);
    }
  });

  // Align Open-Meteo (ECMWF ERA5) and METAR data
  const data = ecmwfHistory.hourly.time.map((timeStr, idx) => {
    const ecmwfTemp = ecmwfHistory.hourly.temperature_2m[idx];
    
    // Open-Meteo time format is "2026-07-18T10:00" -> prefix is "2026-07-18T10"
    const hourKey = timeStr.substring(0, 13);
    const metarTemp = metarMap.get(hourKey);

    // Format local time label (Open-Meteo time is in UTC since we didn't pass timezone to historical URL)
    const localDate = new Date(timeStr + ":00Z");
    const label = localDate.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      name: label,
      ECMWF: ecmwfTemp !== null ? parseFloat(ecmwfTemp.toFixed(1)) : null,
      METAR: metarTemp !== undefined ? parseFloat(metarTemp.toFixed(1)) : null,
    };
  }).filter((d) => d.ECMWF !== null || d.METAR !== null);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Visualisasi Model ECMWF vs Aktual METAR
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Suhu (°C) dalam 48 jam terakhir di {stationName}
        </p>
      </div>

      <div className="h-[260px] sm:h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 10,
              left: -20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              className="fill-slate-500 dark:fill-slate-400"
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10 }}
              className="fill-slate-500 dark:fill-slate-400"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(30, 41, 59, 0.9)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Legend verticalAlign="top" height={36} />
            <Line
              type="monotone"
              dataKey="ECMWF"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
              name="Model ECMWF (ERA5)"
            />
            <Line
              type="monotone"
              dataKey="METAR"
              stroke="#10b981"
              strokeWidth={2}
              dot={true}
              activeDot={{ r: 6 }}
              name={`Aktual METAR (${stationName})`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
