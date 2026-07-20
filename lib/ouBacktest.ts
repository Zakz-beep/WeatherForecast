/**
 * lib/ouBacktest.ts
 * Pure math helpers for OU prediction backtesting.
 * Compares yesterday's OU forecast vs today's METAR-observed actual temperature.
 */

// ── Interfaces ─────────────────────────────────────────────────────────────────

/** One day of OU prediction stored in Supabase */
export interface OUPredictionRow {
  date: string;           // ISO: day the prediction was MADE (yesterday's date)
  target_date: string;    // ISO: day being predicted (= date + 1 day)
  predicted_p50: number;  // OU median forecast (°C)
  predicted_p10?: number | null;
  predicted_p90?: number | null;
  ou_mean?: number | null;
  theta?: number | null;
  regime?: string | null;
  source_temp?: number | null;
  confidence_score?: number | null;
}

/** Joined row: prediction + actual temperature for the target date */
export interface BacktestRow {
  targetDate: string;       // date the prediction was FOR
  predictedTemp: number;    // OU P50 forecast
  actualTemp: number;       // actual max temp from weather_comparison_2026
  error: number;            // actualTemp - predictedTemp
  absError: number;         // |error|
  sqError: number;          // error²
  percentError: number;     // 100 * |error| / actualTemp
  withinOne: boolean;       // |error| <= 1.0°C
  withinTwo: boolean;       // |error| <= 2.0°C
  regime?: string | null;
  confidenceScore?: number | null;
  p10?: number | null;
  p90?: number | null;
}

/** Aggregated backtesting metrics */
export interface BacktestMetrics {
  rmse: number;            // Root Mean Squared Error (°C)
  mae: number;             // Mean Absolute Error (°C)
  mape: number;            // Mean Absolute Percentage Error (%)
  hitRate1: number;        // % days where |error| <= 1°C
  hitRate2: number;        // % days where |error| <= 2°C
  meanBias: number;        // systematic bias (positive = model under-predicts)
  n: number;               // total sample size
  /** Rating based on RMSE */
  rating: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  ratingLabel: string;
  ratingColor: string;
  ratingBg: string;
  ratingBorder: string;
}

/** Rolling window entry (for chart) */
export interface RollingWindowEntry {
  date: string;
  rmse: number;
  mae: number;
  n: number;
}

// ── Math Helpers ───────────────────────────────────────────────────────────────

/**
 * Join OU predictions with actual temperatures.
 * Matches prediction.target_date === actual.date
 */
export function joinPredictionsWithActuals(
  predictions: OUPredictionRow[],
  actuals: Array<{ date: string; actual_temp_max: number }>
): BacktestRow[] {
  const actualMap = new Map(actuals.map((a) => [a.date, a.actual_temp_max]));

  const rows: BacktestRow[] = [];
  for (const pred of predictions) {
    const actual = actualMap.get(pred.target_date);
    if (actual == null || isNaN(actual)) continue;

    const error = actual - pred.predicted_p50;
    const absError = Math.abs(error);

    rows.push({
      targetDate: pred.target_date,
      predictedTemp: pred.predicted_p50,
      actualTemp: actual,
      error,
      absError,
      sqError: error * error,
      percentError: (absError / Math.abs(actual)) * 100,
      withinOne: absError <= 1.0,
      withinTwo: absError <= 2.0,
      regime: pred.regime ?? null,
      confidenceScore: pred.confidence_score ?? null,
      p10: pred.predicted_p10 ?? null,
      p90: pred.predicted_p90 ?? null,
    });
  }

  // Sort chronologically
  return rows.sort((a, b) => a.targetDate.localeCompare(b.targetDate));
}

/**
 * Compute aggregate backtesting metrics from joined rows.
 */
export function computeBacktestMetrics(rows: BacktestRow[]): BacktestMetrics | null {
  if (rows.length === 0) return null;

  const n = rows.length;
  const rmse = Math.sqrt(rows.reduce((acc, r) => acc + r.sqError, 0) / n);
  const mae = rows.reduce((acc, r) => acc + r.absError, 0) / n;
  const mape = rows.reduce((acc, r) => acc + r.percentError, 0) / n;
  const hitRate1 = (rows.filter((r) => r.withinOne).length / n) * 100;
  const hitRate2 = (rows.filter((r) => r.withinTwo).length / n) * 100;
  const meanBias = rows.reduce((acc, r) => acc + r.error, 0) / n;

  // Rating thresholds tuned for Singapore temperature variability (σ ~1.1–2.0°C)
  let rating: BacktestMetrics["rating"];
  let ratingLabel: string;
  let ratingColor: string;
  let ratingBg: string;
  let ratingBorder: string;

  if (rmse < 0.8) {
    rating = "EXCELLENT";
    ratingLabel = "Model Sangat Akurat";
    ratingColor = "text-emerald-600 dark:text-emerald-400";
    ratingBg = "bg-emerald-50 dark:bg-emerald-950/30";
    ratingBorder = "border-emerald-200 dark:border-emerald-800";
  } else if (rmse < 1.5) {
    rating = "GOOD";
    ratingLabel = "Model Akurat";
    ratingColor = "text-sky-600 dark:text-sky-400";
    ratingBg = "bg-sky-50 dark:bg-sky-950/30";
    ratingBorder = "border-sky-200 dark:border-sky-800";
  } else if (rmse < 2.5) {
    rating = "FAIR";
    ratingLabel = "Perlu Kalibrasi";
    ratingColor = "text-amber-600 dark:text-amber-400";
    ratingBg = "bg-amber-50 dark:bg-amber-950/30";
    ratingBorder = "border-amber-200 dark:border-amber-800";
  } else {
    rating = "POOR";
    ratingLabel = "Kalibrasi Diperlukan";
    ratingColor = "text-rose-600 dark:text-rose-400";
    ratingBg = "bg-rose-50 dark:bg-rose-950/30";
    ratingBorder = "border-rose-200 dark:border-rose-800";
  }

  return {
    rmse: parseFloat(rmse.toFixed(3)),
    mae: parseFloat(mae.toFixed(3)),
    mape: parseFloat(mape.toFixed(2)),
    hitRate1: parseFloat(hitRate1.toFixed(1)),
    hitRate2: parseFloat(hitRate2.toFixed(1)),
    meanBias: parseFloat(meanBias.toFixed(3)),
    n,
    rating,
    ratingLabel,
    ratingColor,
    ratingBg,
    ratingBorder,
  };
}

/**
 * Compute rolling 30-day RMSE/MAE for time-series chart.
 */
export function computeRollingMetrics(
  rows: BacktestRow[],
  windowDays: number = 30
): RollingWindowEntry[] {
  if (rows.length === 0) return [];

  return rows.map((_, i) => {
    const windowStart = Math.max(0, i - windowDays + 1);
    const window = rows.slice(windowStart, i + 1);
    const n = window.length;
    const rmse = Math.sqrt(window.reduce((a, r) => a + r.sqError, 0) / n);
    const mae = window.reduce((a, r) => a + r.absError, 0) / n;

    return {
      date: rows[i].targetDate,
      rmse: parseFloat(rmse.toFixed(3)),
      mae: parseFloat(mae.toFixed(3)),
      n,
    };
  });
}
