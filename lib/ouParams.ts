/**
 * Shared Ornstein-Uhlenbeck (OU) monthly parameters for Changi Airport (WSSS).
 * diurnalAmplitude: half-range of Singapore's diurnal temperature cycle (°C).
 * Peak hour: 14:00 SGT (UTC+8). Trough: ~06:00 SGT.
 */
export interface MonthOU {
  month: string;
  shortMonth: string;
  mean: number;          // gravity anchor μ (°C)
  sigma: number;         // monthly volatility σ (°C)
  minRange: number;      // μ - 1σ
  maxRange: number;      // μ + 1σ
  season: string;
  diurnalAmplitude: number; // A in T(h) = μ + A·cos(2π·(h-14)/24)
}

export const OU_MONTHS: MonthOU[] = [
  { month: "Januari",   shortMonth: "Jan", mean: 29.48, sigma: 1.91, minRange: 27.57, maxRange: 31.39, season: "Monsun Timur Laut (Basah & Dingin)",      diurnalAmplitude: 1.1  },
  { month: "Februari",  shortMonth: "Feb", mean: 31.00, sigma: 1.25, minRange: 29.75, maxRange: 32.25, season: "Transisi (Mulai Kering)",                  diurnalAmplitude: 1.4  },
  { month: "Maret",     shortMonth: "Mar", mean: 31.26, sigma: 2.03, minRange: 29.23, maxRange: 33.29, season: "Transisi (Volatilitas Tinggi)",            diurnalAmplitude: 1.75 },
  { month: "April",     shortMonth: "Apr", mean: 32.04, sigma: 1.49, minRange: 30.55, maxRange: 33.53, season: "Periode Equinox (Panas)",                  diurnalAmplitude: 2.0  },
  { month: "Mei",       shortMonth: "Mei", mean: 32.06, sigma: 1.17, minRange: 30.89, maxRange: 33.23, season: "Awal Monsun Barat Daya (Panas)",           diurnalAmplitude: 1.9  },
  { month: "Juni",      shortMonth: "Jun", mean: 31.74, sigma: 1.14, minRange: 30.60, maxRange: 32.88, season: "Monsun Barat Daya (Stabil Panas)",         diurnalAmplitude: 1.6  },
  { month: "Juli",      shortMonth: "Jul", mean: 31.56, sigma: 1.18, minRange: 30.38, maxRange: 32.74, season: "Tengah Tahun (Stabil/Jinak)",              diurnalAmplitude: 1.5  },
  { month: "Agustus",   shortMonth: "Agu", mean: 31.35, sigma: 1.13, minRange: 30.22, maxRange: 32.48, season: "Tengah Tahun (Stabil/Jinak)",              diurnalAmplitude: 1.5  },
  { month: "September", shortMonth: "Sep", mean: 31.34, sigma: 1.29, minRange: 30.05, maxRange: 32.63, season: "Transisi",                                 diurnalAmplitude: 1.6  },
  { month: "Oktober",   shortMonth: "Okt", mean: 32.02, sigma: 1.33, minRange: 30.69, maxRange: 33.35, season: "Transisi Volatil (Mulai Basah)",           diurnalAmplitude: 1.75 },
  { month: "November",  shortMonth: "Nov", mean: 31.44, sigma: 1.36, minRange: 30.08, maxRange: 32.80, season: "Awal Monsun Timur Laut (Mulai Dingin)",    diurnalAmplitude: 1.25 },
  { month: "Desember",  shortMonth: "Des", mean: 30.71, sigma: 1.49, minRange: 29.22, maxRange: 32.20, season: "Monsun Timur Laut (Basah & Dingin)",       diurnalAmplitude: 1.1  },
];
