import { MetarData } from "@/services/metarService";
import { Plane, Eye, Gauge, Thermometer, Wind, Cloud, ShieldAlert } from "lucide-react";

// Translate flight categories
function getFlightCategoryInfo(fltCat: string) {
  switch (fltCat?.toUpperCase()) {
    case "VFR":
      return {
        label: "VFR (Visual Flight Rules)",
        desc: "Cuaca kondusif untuk penerbangan visual biasa.",
        bgClass: "bg-emerald-500/25 border-emerald-500/50 text-emerald-400",
        dotClass: "bg-emerald-500"
      };
    case "MVFR":
      return {
        label: "MVFR (Marginal VFR)",
        desc: "Cuaca marginal, pilot non-instrumen harus waspada.",
        bgClass: "bg-blue-500/25 border-blue-500/50 text-blue-400",
        dotClass: "bg-blue-500"
      };
    case "IFR":
      return {
        label: "IFR (Instrument Flight Rules)",
        desc: "Hanya penerbangan instrumen yang diizinkan karena jarak pandang rendah.",
        bgClass: "bg-red-500/25 border-red-500/50 text-red-400",
        dotClass: "bg-red-500"
      };
    case "LIFR":
      return {
        label: "LIFR (Low IFR)",
        desc: "Kondisi cuaca sangat buruk. Jarak pandang sangat terbatas.",
        bgClass: "bg-fuchsia-500/25 border-fuchsia-500/50 text-fuchsia-400",
        dotClass: "bg-fuchsia-500"
      };
    default:
      return {
        label: "TIDAK DIKETAHUI",
        desc: "Kategori penerbangan tidak terdefinisi.",
        bgClass: "bg-slate-500/25 border-slate-500/50 text-slate-400",
        dotClass: "bg-slate-500"
      };
  }
}

// Translate METAR weather phenomena strings
export function translateWxString(wxStr: string | null) {
  if (!wxStr) return "Cuaca Cerah / Kondusif";
  
  const translations: { [key: string]: string } = {
    "+TSRA": "Badai Petir & Hujan Lebat",
    "TSRA": "Badai Petir & Hujan",
    "-TSRA": "Badai Petir & Hujan Ringan",
    "VCTS": "Petir di Sekitar Bandara (VCTS)",
    "+SHRA": "Hujan Deras Sementara (Showers)",
    "SHRA": "Hujan Sementara (Showers)",
    "-SHRA": "Hujan Ringan Sementara (Showers)",
    "VCSH": "Hujan/Gerimis di Sekitar Bandara",
    "RA": "Hujan (Rain)",
    "-RA": "Hujan Ringan (Light Rain)",
    "+RA": "Hujan Lebat (Heavy Rain)",
    "DZ": "Gerimis (Drizzle)",
    "FG": "Kabut Tebal (Fog)",
    "BR": "Kabut Tipis (Mist)",
    "HZ": "Halimun (Haze)",
    "FU": "Asap (Smoke)",
    "SQ": "Angin Kencang Mendadak (Squall)"
  };

  // Check direct matches first
  if (translations[wxStr]) return translations[wxStr];

  // If complex string (like -TSRA VCSH) split and translate
  return wxStr.split(" ").map(word => translations[word] || word).join(" & ");
}

interface ExtendedMetarWidgetProps {
  data: MetarData & {
    cover?: string;
    clouds?: Array<{ cover: string; base: number }>;
    fltCat?: string;
    slp?: number;
  };
}

export default function MetarWidget({ data }: ExtendedMetarWidgetProps) {
  if (!data) return null;

  const flightCat = getFlightCategoryInfo(data.fltCat || "VFR");
  const weatherPhenomena = translateWxString(data.wxString);

  // Spread calculation (difference between temp and dewpoint)
  const spread = data.temp - data.dewp;
  const fogRisk = spread <= 3 ? "Tinggi (Kelembapan Tinggi)" : "Rendah";

  return (
    <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-800 text-slate-100 transition-colors w-full">
      {/* Widget Header with LIVE Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 sm:p-3 bg-blue-500/10 rounded-2xl text-blue-400">
            <Plane size={20} className="rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base md:text-lg text-white">Stasiun Cuaca Penerbangan</h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">LIVE</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">Bandara: {data.name} ({data.icaoId})</p>
          </div>
        </div>
        
        <div className="sm:text-right">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Terakhir Diperbarui</p>
          <p className="text-xs sm:text-sm font-semibold text-slate-300">
            {(() => {
              // Ensure the browser parses receiptTime (which is in UTC) correctly
              const utcString = data.receiptTime.includes("Z") 
                ? data.receiptTime 
                : data.receiptTime.replace(" ", "T") + "Z";
              return new Date(utcString).toLocaleString("id-ID", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
              });
            })()}
          </p>
        </div>
      </div>

      {/* Raw METAR Telegram */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">METAR Raw Data (Sandi Cuaca)</span>
          <span className="text-[9px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">{data.icaoId} OBS</span>
        </div>
        <div className="bg-slate-950 p-3 rounded-2xl font-mono text-xs sm:text-sm text-green-400 border border-slate-800 shadow-inner break-all select-all">
          {data.rawOb}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Side Panel - Main stats */}
        <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-950/40 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] sm:text-xs">Arah & Angin</span>
              <Wind size={14} />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-white">{data.wdir === 0 ? "VRB" : `${data.wdir}°`}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Kecepatan: <span className="font-semibold text-white">{data.wspd} kt</span></p>
              {data.wgst && <p className="text-[9px] text-amber-400 mt-0.5">Gust: {data.wgst} kt</p>}
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] sm:text-xs">Jarak Pandang</span>
              <Eye size={14} />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-white">{data.visib}+ mil</p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Kondisi: <span className="font-semibold text-white">Visual Safe</span></p>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] sm:text-xs">Tekanan Udara</span>
              <Gauge size={14} />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-white">{data.altim.toFixed(2)}</p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">SLP: <span className="font-semibold text-white">{data.slp || 1013} hPa</span></p>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/80 p-3 sm:p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] sm:text-xs">Suhu & Embun</span>
              <Thermometer size={14} />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-white">{data.temp}°C</p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Titik Embun: <span className="font-semibold text-white">{data.dewp}°C</span></p>
            </div>
          </div>
        </div>

        {/* Right Side Panel - Flight Category Indicator */}
        <div className="md:col-span-4 bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Kategori Terbang</span>
            <span className={`h-3 w-3 rounded-full ${flightCat.dotClass} animate-pulse`} />
          </div>
          <div className="my-4">
            <div className={`inline-block px-3 py-1.5 rounded-xl border text-sm font-bold ${flightCat.bgClass} mb-2`}>
              {flightCat.label}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{flightCat.desc}</p>
          </div>
        </div>
      </div>

      {/* Expanded METAR Parameters Table/List */}
      <div className="mt-6 border-t border-slate-800 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clouds & Sky Coverage */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Cloud size={14} />
            <span>Kondisi Awan & Langit</span>
          </h4>
          <div className="bg-slate-950/30 border border-slate-800/60 rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between text-xs border-b border-slate-800/40 pb-2">
              <span className="text-slate-400">Tutupan Langit Utama:</span>
              <span className="font-bold text-white">{data.cover || "CLR (Cerah)"}</span>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-500 font-semibold uppercase">Lapisan Awan (Cloud Layers)</p>
              {data.clouds && data.clouds.length > 0 ? (
                data.clouds.map((cloud, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-slate-300">
                    <span>Lapisan {idx + 1}: <span className="font-semibold text-white">{cloud.cover}</span></span>
                    <span>Ketinggian: <span className="font-semibold text-white">{cloud.base.toLocaleString()} kaki (ft)</span></span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">Tidak terdeteksi lapisan awan rendah/sedang (Langit Bersih).</p>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Phenomena & Station Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert size={14} />
            <span>Fenomena & Informasi Stasiun</span>
          </h4>
          <div className="bg-slate-950/30 border border-slate-800/60 rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Cuaca Terjemahan:</span>
              <span className="font-semibold text-emerald-400">{weatherPhenomena}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Risiko Kabut (Fog Risk):</span>
              <span className={`font-semibold ${spread <= 3 ? "text-amber-400" : "text-slate-300"}`}>
                {fogRisk} (Selisih Suhu-Embun: {spread}°C)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Elevasi Stasiun:</span>
              <span className="font-semibold text-slate-300">{data.elev} meter / {Math.round(data.elev * 3.28084)} kaki</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
