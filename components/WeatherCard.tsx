import { WeatherData } from "@/services/weatherService";
import { MetarData } from "@/services/metarService";
import { translateWxString } from "./MetarWidget";
import { getWeatherInfo } from "@/lib/weatherCodes";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import {
  Droplets,
  Wind,
  Thermometer,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
} from "lucide-react";
import ForecastCards from "./ForecastCards";

interface WeatherCardProps {
  data: WeatherData;
  cityName: string;
  metarData?: MetarData | null;
}

// Map METAR weather phenomena to icons
function getMetarWeatherInfo(wxStr: string | null, cover: string | null) {
  const ws = wxStr?.toUpperCase() || "";
  const label = translateWxString(wxStr);

  if (ws.includes("TS")) return { label, icon: CloudLightning };
  if (ws.includes("RA") || ws.includes("SH")) return { label, icon: CloudRain };
  if (ws.includes("DZ")) return { label, icon: CloudDrizzle };
  if (ws.includes("SN")) return { label, icon: CloudSnow };
  if (
    ws.includes("FG") ||
    ws.includes("BR") ||
    ws.includes("HZ") ||
    ws.includes("FU")
  ) {
    return { label, icon: CloudFog };
  }

  const cov = cover?.toUpperCase() || "";
  if (cov.includes("OVC") || cov.includes("BKN")) {
    return { label: "Mendung / Berawan Tebal", icon: Cloud };
  }
  if (cov.includes("SCT") || cov.includes("FEW")) {
    return { label: "Berawan Sebagian", icon: CloudSun };
  }

  return { label: "Cerah", icon: Sun };
}

export default function WeatherCard({ data, cityName, metarData }: WeatherCardProps) {
  const current = data.current;
  const isMetar = !!metarData;

  // Primary Temperature
  const temp = isMetar ? metarData.temp : current.temperature_2m;

  // Formatted date and time
  const timeString = isMetar
    ? format(new Date(metarData.obsTime * 1000), "EEEE, d MMMM yyyy | HH:mm", {
        locale: id,
      })
    : format(parseISO(current.time), "EEEE, d MMMM yyyy | HH:mm", {
        locale: id,
      });

  // Wind speed in km/h (METAR wspd is in knots, 1 knot = 1.852 km/h)
  const windSpeed = isMetar
    ? parseFloat((metarData.wspd * 1.852).toFixed(1))
    : current.wind_speed_10m;

  // Relative Humidity (if METAR, calculate from temp and dewpoint using Magnus formula)
  const humidity = isMetar
    ? Math.round(
        100 *
          Math.exp(
            (17.625 * metarData.dewp) / (243.04 + metarData.dewp) -
              (17.625 * metarData.temp) / (243.04 + metarData.temp)
          )
      )
    : current.relative_humidity_2m;

  // Weather Icon & Label
  const { icon: WeatherIcon, label } = isMetar
    ? getMetarWeatherInfo(metarData.wxString, metarData.cover ?? null)
    : getWeatherInfo(current.weather_code);

  return (
    <div className="w-full space-y-6">
      {/* Current Weather */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-5 sm:p-8 opacity-10">
          <WeatherIcon size={160} className="sm:w-[200px] sm:h-[200px]" />
        </div>
        <div className="relative z-10">
          {/* Header row with City Name and Data Source Badge */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 mb-4 sm:mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{cityName}</h2>
              <p className="text-xs sm:text-sm text-blue-100">{timeString}</p>
            </div>
            <div className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-[10px] sm:text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>{isMetar ? `Live METAR (${metarData.icaoId})` : "ECMWF Forecast"}</span>
            </div>
          </div>

          <div className="flex items-end gap-4 sm:gap-6 mb-4 sm:mb-8">
            <span className="text-5xl sm:text-7xl font-bold leading-none">
              {temp.toFixed(1)}°
            </span>
            <div className="flex flex-col pb-0.5">
              <span className="text-xl sm:text-2xl font-medium leading-tight">
                {label}
              </span>
              <span className="text-blue-100 text-xs sm:text-sm mt-0.5">
                {isMetar
                  ? `Observasi riil stasiun udara bandara`
                  : `Terasa seperti ${current.apparent_temperature.toFixed(1)}°`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-blue-400/30 pt-4 sm:pt-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Wind size={18} className="text-blue-200 flex-shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-blue-200">Angin</p>
                <p className="text-xs sm:text-sm font-semibold">
                  {windSpeed.toFixed(1)} km/j
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Droplets size={18} className="text-blue-200 flex-shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-blue-200">Kelembapan</p>
                <p className="text-xs sm:text-sm font-semibold">
                  {humidity}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Thermometer size={18} className="text-blue-200 flex-shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-blue-200">
                  {isMetar ? "Titik Embun" : "Presipitasi"}
                </p>
                <p className="text-xs sm:text-sm font-semibold">
                  {isMetar
                    ? `${metarData.dewp.toFixed(1)}°C`
                    : `${current.precipitation.toFixed(1)} mm`}
                </p>
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
