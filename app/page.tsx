import Link from "next/link";
import CitySearch from "@/components/CitySearch";
import WeatherCard from "@/components/WeatherCard";
import MetarWidget from "@/components/MetarWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getWeather, getHourlyHistory, getWeatherHistory2026, getOUPredictions } from "@/services/weatherService";
import { getNearbyMetar, getHistoricalMetar, computeTempEstimate } from "@/services/metarService";

import HistoryChart from "@/components/HistoryChart";
import History2026Chart from "@/components/History2026Chart";
import BiasCorrectionPanel from "@/components/BiasCorrectionPanel";
import OUMeanReversionPanel from "@/components/OUMeanReversionPanel";
import OUBacktestPanel from "@/components/OUBacktestPanel";
import {
  joinPredictionsWithActuals,
  computeBacktestMetrics,
  computeRollingMetrics,
  type OUPredictionRow,
} from "@/lib/ouBacktest";
import { detectRegime } from "@/components/OUMeanReversionPanel";
import { OU_MONTHS } from "@/lib/ouParams";
import { Plane, Compass, BarChart3, ArrowLeft, ExternalLink, MapPin } from "lucide-react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function Home(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  
  const hasCoordinates = searchParams?.lat && searchParams?.lon;
  
  if (!hasCoordinates) {
    // Render Beautiful Landing Page
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-20 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400/10 dark:bg-blue-600/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-400/10 dark:bg-indigo-600/5 blur-[150px] pointer-events-none" />

        {/* Top Header */}
        <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between relative z-10">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
            SkyCast
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </header>

        {/* Hero Section */}
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-6 border border-blue-100 dark:border-blue-900/50">
            <Plane size={14} className="animate-pulse" />
            <span>Sistem Pemantauan Cuaca Aviasi & Global</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent leading-tight">
            Portal Prakiraan Cuaca & Observasi Bandara
          </h2>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Integrasi data model presisi tinggi <span className="font-semibold text-slate-700 dark:text-slate-300">ECMWF</span> dan laporan aktual <span className="font-semibold text-slate-700 dark:text-slate-300">METAR</span> penerbangan dari bandara di seluruh dunia.
          </p>

          {/* Search Bar - LARGE Variant */}
          <div className="flex justify-center mb-16">
            <CitySearch variant="large" />
          </div>
        </section>

        {/* Quick Access Airports Grid */}
        <section className="max-w-5xl mx-auto px-6 relative z-10 mb-20">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
            <Compass size={20} className="text-blue-500" />
            <span>Akses Cepat Hub Penerbangan Utama</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main Primary Card - Singapore Changi */}
            <Link 
              href="/?lat=1.3644&lon=103.9915&name=Singapore%20(WSSS)"
              className="md:col-span-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 group flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2">
                <div className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-bold tracking-wider mb-2">REKOMENDASI UTAMA</div>
                <h4 className="text-3xl font-extrabold flex items-center gap-2">
                  Singapore Changi Airport
                  <span className="text-blue-200 font-mono text-xl">(WSSS)</span>
                </h4>
                <p className="text-blue-100 max-w-xl">
                  Akses langsung ke dashboard Singapura lengkap dengan komparasi cuaca ECMWF dan observasi METAR real-time untuk bandara Changi.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold bg-white text-blue-600 px-5 py-3 rounded-full hover:bg-slate-100 transition-colors self-start md:self-auto">
                <span>Buka Dashboard</span>
                <ExternalLink size={16} />
              </div>
            </Link>

            {/* Jakarta WIII */}
            <Link 
              href="/?lat=-6.1256&lon=106.6558&name=Jakarta%20(WIII)"
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between h-48 group"
            >
              <div>
                <span className="text-xs font-mono text-blue-500 font-bold">WIII</span>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">Soekarno-Hatta Intl</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Jakarta, Indonesia</p>
              </div>
              <span className="text-xs font-semibold text-blue-500 group-hover:translate-x-1 transition-transform flex items-center gap-1 self-start">
                Lihat Detail →
              </span>
            </Link>

            {/* Tokyo Haneda */}
            <Link 
              href="/?lat=35.5494&lon=139.7798&name=Tokyo%20(RJTT)"
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between h-48 group"
            >
              <div>
                <span className="text-xs font-mono text-blue-500 font-bold">RJTT</span>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">Tokyo Haneda Airport</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Tokyo, Jepang</p>
              </div>
              <span className="text-xs font-semibold text-blue-500 group-hover:translate-x-1 transition-transform flex items-center gap-1 self-start">
                Lihat Detail →
              </span>
            </Link>

            {/* London Heathrow */}
            <Link 
              href="/?lat=51.4700&lon=-0.4543&name=London%20(EGLL)"
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between h-48 group"
            >
              <div>
                <span className="text-xs font-mono text-blue-500 font-bold">EGLL</span>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">London Heathrow</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">London, Inggris Raya</p>
              </div>
              <span className="text-xs font-semibold text-blue-500 group-hover:translate-x-1 transition-transform flex items-center gap-1 self-start">
                Lihat Detail →
              </span>
            </Link>
          </div>
        </section>

        {/* Features / Benefit Section */}
        <section className="max-w-5xl mx-auto px-6 py-10 border-t border-slate-200 dark:border-slate-800 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl w-fit">
                <Plane size={24} />
              </div>
              <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">METAR Penerbangan</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Teks observasi mentah dari stasiun cuaca bandara yang secara otomatis diterjemahkan menjadi parameter cuaca yang mudah dibaca oleh siapa saja.
              </p>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl w-fit">
                <Compass size={24} />
              </div>
              <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Prakiraan ECMWF Presisi</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Data prakiraan cuaca yang didasarkan pada model sirkulasi atmosfer ECMWF global, memberikan data suhu, presipitasi, dan angin yang andal.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-2xl w-fit">
                <BarChart3 size={24} />
              </div>
              <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Grafik Komparatif Historis</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Visualisasi terpadu untuk membandingkan model prediksi teoritis (ECMWF) dengan pengukuran riil di lapangan (METAR) secara langsung.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Render Weather Dashboard (with lat and lon parameters)
  const lat = parseFloat(searchParams.lat as string);
  const lon = parseFloat(searchParams.lon as string);
  const cityName = (searchParams.name as string) || "Lokasi Pilihan";

  const weatherData = await getWeather(lat, lon);
  const metarData = await getNearbyMetar(lat, lon);
  
  const ecmwfHistory = await getHourlyHistory(lat, lon);
  const metarHistory = metarData ? await getHistoricalMetar(metarData.icaoId, 48) : [];
  
  // 4-stage METAR temperature estimation (QC → diurnal awareness → peak projection → bias correction)
  const tempEstimate = metarHistory.length > 0 ? computeTempEstimate(metarHistory) : null;

  
  const isSingapore = cityName.includes("Singapore") || cityName.includes("WSSS");
  const weatherHistory2026 = isSingapore ? await getWeatherHistory2026() : [];

  // ── OU Backtesting data ────────────────────────────────────────
  const ouPredictionsRaw = isSingapore ? await getOUPredictions() : [];
  const backtestRows = joinPredictionsWithActuals(
    ouPredictionsRaw as OUPredictionRow[],
    weatherHistory2026
  );
  const backtestMetrics = computeBacktestMetrics(backtestRows);
  const backtestRolling = computeRollingMetrics(backtestRows, 30);

  // ── Log today's OU prediction (fire-and-forget) ────────────────────
  if (isSingapore && tempEstimate) {
    const currentMonthIdx = new Date().getMonth();
    const activeMonth = OU_MONTHS[currentMonthIdx];
    const regime = detectRegime(currentMonthIdx);
    const theta = regime.dynamicTheta;

    // Compute OU forecast (same math as OUMeanReversionPanel)
    const dt = 1;
    const expNeg = Math.exp(-theta * dt);
    const exp2Neg = Math.exp(-2 * theta * dt);
    const ouMean = activeMonth.mean + (tempEstimate.correctedPeak - activeMonth.mean) * expNeg;
    const ouStd = Math.sqrt((activeMonth.sigma ** 2 * (1 - exp2Neg)) / (2 * theta));

    const Z_P10 = -1.2816;
    const Z_P90 =  1.2816;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const payload = {
      date: todayStr,
      target_date: tomorrowStr,
      predicted_p50: parseFloat(ouMean.toFixed(2)),
      predicted_p10: parseFloat((ouMean + Z_P10 * ouStd).toFixed(2)),
      predicted_p90: parseFloat((ouMean + Z_P90 * ouStd).toFixed(2)),
      ou_mean: parseFloat(ouMean.toFixed(2)),
      theta: parseFloat(theta.toFixed(3)),
      regime: regime.labelShort,
      source_temp: parseFloat(tempEstimate.correctedPeak.toFixed(2)),
      confidence_score: null, // computed client-side only
    };

    // Fire and forget — don't block page render
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/ou-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => { /* silent fail */ });
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 transition-colors duration-300">
      {/* Dashboard Sticky Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link 
              href="/"
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Kembali ke Beranda"
            >
              <ArrowLeft size={18} />
            </Link>
            <Link href="/" className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity hidden min-[360px]:block">
              SkyCast
            </Link>
          </div>
          <div className="flex-1 flex justify-end items-center gap-2 max-w-md">
            <CitySearch variant="small" className="w-full" />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Dashboard Body */}
      <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 sm:py-8 space-y-6 sm:space-y-8">
        {!weatherData ? (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400">
            Gagal mengambil data cuaca dari satelit. Silakan coba beberapa saat lagi.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Weather Card */}
            <div className="md:col-span-12">
              <WeatherCard 
                data={weatherData} 
                cityName={cityName} 
                metarData={metarData} 
              />
            </div>
            
            {/* Aviation Weather (METAR) */}
            {metarData ? (
              <div className="md:col-span-12">
                <MetarWidget data={metarData} />
              </div>
            ) : (
              <div className="md:col-span-12">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col items-center gap-2">
                  <MapPin size={32} className="text-slate-400" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Data METAR Tidak Ditemukan</p>
                  <p className="text-sm max-w-sm">Tidak ada stasiun cuaca bandara penerbangan dalam radius 55 km dari koordinat kota ini.</p>
                </div>
              </div>
            )}

            {/* Historical Comparison Chart */}
            {ecmwfHistory && metarData && metarHistory.length > 0 && (
              <div className="md:col-span-12">
                <HistoryChart
                  ecmwfHistory={ecmwfHistory}
                  metarHistory={metarHistory}
                  stationName={metarData.icaoId}
                />
              </div>
            )}

            {/* 2026 Supabase History Chart */}
            {isSingapore && (
              <div className="md:col-span-12">
                <History2026Chart
                  initialData={weatherHistory2026}
                  city={cityName}
                />
              </div>
            )}

            {/* Bias Correction Statistical Panel */}
            {isSingapore && weatherHistory2026.length > 0 && (
              <div className="md:col-span-12">
                <BiasCorrectionPanel
                  data={weatherHistory2026}
                  todayForecastTemp={weatherData?.daily?.temperature_2m_max?.[0] ?? null}
                  todayForecastWind={weatherData?.daily?.wind_speed_10m_max?.[0] ?? null}
                />
              </div>
            )}

            {/* Ornstein-Uhlenbeck Mean Reversion Table/Panel */}
            {isSingapore && (
              <div className="md:col-span-12">
                <OUMeanReversionPanel
                  tempEstimate={tempEstimate}
                  todayForecastTemp={weatherData?.daily?.temperature_2m_max?.[0] ?? null}
                />
              </div>
            )}

            {/* OU Backtesting & Accuracy Score */}
            {isSingapore && (
              <div className="md:col-span-12">
                <OUBacktestPanel
                  rows={backtestRows}
                  metrics={backtestMetrics}
                  rolling={backtestRolling}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
