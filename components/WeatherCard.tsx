import { WeatherData } from "@/services/weatherService";
import { getWeatherInfo } from "@/lib/weatherCodes";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { Droplets, Wind, Thermometer } from "lucide-react";
import ForecastCards from "./ForecastCards";

export default function WeatherCard({ data, cityName }: { data: WeatherData; cityName: string }) {
  const current = data.current;
  const { icon: WeatherIcon, label } = getWeatherInfo(current.weather_code);

  return (
    <div className="w-full space-y-6">
      {/* Current Weather */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-5 sm:p-8 opacity-10">
          <WeatherIcon size={160} className="sm:w-[200px] sm:h-[200px]" />
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-3xl font-light mb-0.5">{cityName}</h2>
          <p className="text-xs sm:text-sm text-blue-100 mb-4 sm:mb-8">{format(parseISO(current.time), "EEEE, d MMMM yyyy | HH:mm", { locale: id })}</p>
          
          <div className="flex items-end gap-4 sm:gap-6 mb-4 sm:mb-8">
            <span className="text-5xl sm:text-7xl font-bold leading-none">{Math.round(current.temperature_2m)}°</span>
            <div className="flex flex-col pb-0.5">
              <span className="text-xl sm:text-2xl font-medium leading-tight">{label}</span>
              <span className="text-blue-100 text-xs sm:text-sm mt-0.5">Terasa seperti {Math.round(current.apparent_temperature)}°</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3 border-t border-blue-400/30 pt-4 sm:pt-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Wind size={18} className="text-blue-200 flex-shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-blue-200">Angin</p>
                <p className="text-xs sm:text-sm font-semibold">{current.wind_speed_10m} km/j</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Droplets size={18} className="text-blue-200 flex-shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-blue-200">Kelembapan</p>
                <p className="text-xs sm:text-sm font-semibold">{current.relative_humidity_2m}%</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Thermometer size={18} className="text-blue-200 flex-shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-blue-200">Presipitasi</p>
                <p className="text-xs sm:text-sm font-semibold">{current.precipitation} mm</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Forecast Cards (H-0 to H+6) */}
      <ForecastCards daily={data.daily} />
    </div>
  );
}
