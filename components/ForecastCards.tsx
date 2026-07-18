"use client";

import { WeatherData } from "@/services/weatherService";
import { getWeatherInfo } from "@/lib/weatherCodes";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { Wind, Droplets, ArrowRight } from "lucide-react";

interface ForecastCardsProps {
  daily: WeatherData["daily"];
}

export default function ForecastCards({ daily }: ForecastCardsProps) {
  const getHLabel = (index: number) => {
    switch (index) {
      case 0:
        return { badge: "H-0", label: "Hari Ini" };
      case 1:
        return { badge: "H+1", label: "Besok" };
      case 2:
        return { badge: "H+2", label: "Lusa" };
      default:
        return { badge: `H+${index}`, label: `${index} Hari Lagi` };
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span>Prakiraan Berbasis Hari (H-0 s/d H+6)</span>
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          Geser atau scroll untuk melihat lebih banyak <ArrowRight size={12} />
        </span>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {daily.time.map((time, index) => {
          const { badge, label } = getHLabel(index);
          const { icon: WeatherIcon, label: weatherDesc } = getWeatherInfo(daily.weather_code[index]);
          const maxTemp = Math.round(daily.temperature_2m_max[index]);
          const minTemp = Math.round(daily.temperature_2m_min[index]);
          const rain = daily.precipitation_sum ? daily.precipitation_sum[index] : 0;
          const wind = daily.wind_speed_10m_max ? daily.wind_speed_10m_max[index] : 0;

          const dateObj = parseISO(time);
          const formattedDate = format(dateObj, "EEEE, d MMM", { locale: id });

          return (
            <div
              key={time}
              className="flex-shrink-0 w-[180px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm hover:shadow-md hover:scale-[1.02] dark:hover:border-blue-500/30 transition-all duration-300 snap-start flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30">
                  {badge}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  {label}
                </span>
              </div>

              {/* Weather Icon & Description */}
              <div className="flex flex-col items-center text-center my-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-2 text-blue-500 dark:text-blue-400">
                  <WeatherIcon size={32} />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate w-full" title={weatherDesc}>
                  {weatherDesc}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {formattedDate}
                </span>
              </div>

              {/* Temperatures */}
              <div className="flex justify-center items-baseline gap-2 my-3">
                <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{maxTemp}°</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">/ {minTemp}°</span>
              </div>

              {/* Card Footer Details */}
              <div className="grid grid-cols-2 gap-1 border-t border-slate-100 dark:border-slate-800/60 pt-3 text-[10px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1 justify-center" title="Kecepatan Angin Maksimum">
                  <Wind size={12} className="text-slate-400" />
                  <span>{Math.round(wind)} km/j</span>
                </div>
                <div className="flex items-center gap-1 justify-center" title="Presipitasi Harian">
                  <Droplets size={12} className="text-slate-400" />
                  <span>{rain} mm</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
