/**
 * lib/ouRegime.ts
 * Pure (server-safe) regime detection helpers — NO "use client".
 * Can be imported by both server components (page.tsx) and client components.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type MonsoonRegime =
  | "NE_MONSOON"      // Nov–Jan: Northeast Monsoon (wet & cool)
  | "NE_TRANSITION"   // Feb–Mar: Transition away from NE (drying, volatile)
  | "EQUINOX_HEAT"    // Apr–May: Equinox / hottest period
  | "SW_MONSOON"      // Jun–Sep: Southwest Monsoon (stable, warm)
  | "SW_TRANSITION";  // Oct:     Transition back to NE (volatile, wetting)

export interface RegimeInfo {
  regime: MonsoonRegime;
  label: string;
  labelShort: string;
  description: string;
  /** Dynamic mean-reversion speed θ calibrated per regime */
  dynamicTheta: number;
  thetaRationale: string;
  color: string;        // tailwind text color class
  bgColor: string;      // tailwind bg color class
  borderColor: string;  // tailwind border color class
  icon: "wind" | "thermometer" | "activity" | "zap" | "layers";
}

// ── detectRegime ───────────────────────────────────────────────────────────────

/** Returns the monsoon regime + dynamic θ for a given 0-indexed month */
export function detectRegime(monthIdx: number): RegimeInfo {
  // Nov=10, Dec=11, Jan=0
  if (monthIdx === 11 || monthIdx === 0 || monthIdx === 10) {
    return {
      regime: "NE_MONSOON",
      label: "Monsun Timur Laut",
      labelShort: "NE Monsoon",
      description:
        "Periode basah & dingin. Curah hujan tinggi, tutupan awan tebal, dan suhu lebih rendah menekan puncak diurnal. Daya tarik OU lebih kuat karena anomali suhu cepat teredam oleh hujan konvektif.",
      dynamicTheta: 0.32,
      thetaRationale: "θ tinggi (0.32): anomali suhu teredam cepat oleh hujan konvektif.",
      color: "text-sky-600 dark:text-sky-400",
      bgColor: "bg-sky-50 dark:bg-sky-950/30",
      borderColor: "border-sky-200 dark:border-sky-800",
      icon: "wind",
    };
  }
  if (monthIdx === 1 || monthIdx === 2) {
    return {
      regime: "NE_TRANSITION",
      label: "Transisi NE → SW",
      labelShort: "Transisi",
      description:
        "Periode volatilitas tertinggi — σ meningkat, tutupan awan tidak menentu. Model OU membutuhkan θ yang lebih rendah karena anomali suhu bisa bertahan lebih lama akibat perubahan pola angin.",
      dynamicTheta: 0.20,
      thetaRationale: "θ rendah (0.20): anomali suhu lebih persisten, volatilitas σ tinggi.",
      color: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-50 dark:bg-violet-950/30",
      borderColor: "border-violet-200 dark:border-violet-800",
      icon: "activity",
    };
  }
  if (monthIdx === 3 || monthIdx === 4) {
    return {
      regime: "EQUINOX_HEAT",
      label: "Periode Ekuinoks (Panas)",
      labelShort: "Ekuinoks",
      description:
        "Puncak suhu tahunan. Radiasi matahari maksimum, amplitudo diurnal terbesar. Suhu bergerak jauh di atas μ namun tetap kuat mean-revert karena driving force surya sangat konsisten.",
      dynamicTheta: 0.28,
      thetaRationale: "θ sedang (0.28): panas ekstrem namun radiasi konsisten menjaga pola reversion.",
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-950/30",
      borderColor: "border-rose-200 dark:border-rose-800",
      icon: "thermometer",
    };
  }
  if (monthIdx >= 5 && monthIdx <= 8) {
    return {
      regime: "SW_MONSOON",
      label: "Monsun Barat Daya",
      labelShort: "SW Monsoon",
      description:
        "Periode paling stabil sepanjang tahun. Angin Southwesterly membawa udara kering relatif, suhu stabil di kisaran μ dengan σ kecil. θ sedikit lebih rendah karena variasi harian lebih jinak.",
      dynamicTheta: 0.22,
      thetaRationale: "θ moderat-rendah (0.22): variabilitas rendah, suhu sangat stabil di dekat μ.",
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
      borderColor: "border-emerald-200 dark:border-emerald-800",
      icon: "layers",
    };
  }
  // Oktober = monthIdx 9
  return {
    regime: "SW_TRANSITION",
    label: "Transisi SW → NE",
    labelShort: "Transisi",
    description:
      "Periode mulai basah kembali. Konveksi sore hari meningkat, hujan petir lebih sering. Anomali suhu moderat namun bisa bertahan lebih lama karena perubahan massa udara.",
    dynamicTheta: 0.22,
    thetaRationale: "θ moderat (0.22): hujan sore menekan puncak, anomali semi-persisten.",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    icon: "zap",
  };
}
