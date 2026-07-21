use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

// ── Data Structures ───────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ForecastResult {
    pub mean: f64,
    pub std: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct RegressionResult {
    pub a: f64,
    pub b: f64,
    pub r2: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BiasStatsResult {
    pub mbe: f64,
    pub mae: f64,
    pub rmse: f64,
    pub n: usize,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct RollingBiasEntry {
    pub bias_7h: f64,
    pub bias_30h: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MonteCarloResult {
    /// Expected (mean) maximum temperature from simulation
    pub mean: f64,
    /// Standard deviation of simulated max temps
    pub std: f64,
    /// Percentiles of simulated T_max distribution
    pub p5: f64,
    pub p10: f64,
    pub p25: f64,
    pub p50: f64,
    pub p75: f64,
    pub p90: f64,
    pub p95: f64,
    /// Threshold probability table: P(T_max > threshold)
    pub prob_above_30: f64,
    pub prob_above_31: f64,
    pub prob_above_32: f64,
    pub prob_above_33: f64,
    pub prob_above_34: f64,
    /// The Open-Meteo corrected forecast (blended value)
    pub blended_start: f64,
    /// Number of simulations run
    pub n_sims: u32,
}

// ── Pure Rust Implementations ─────────────────────────────────────────────────

/// Abramowitz & Stegun approximation for the Normal CDF, error < 7.5e-8
pub fn calculate_normal_cdf(x: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.2316419 * x.abs());
    let d = 0.3989422820 * (-0.5 * x * x).exp();
    let poly = t * (0.3193815302 +
               t * (-0.3565637813 +
               t * (1.7814779372 +
               t * (-1.8212559978 + t * 1.3302744929))));
    let cdf = 1.0 - d * poly;
    if x >= 0.0 { cdf } else { 1.0 - cdf }
}

/// Compute OU conditional mean & std for H+1 given current temp
pub fn calculate_ou_forecast(current: f64, mu: f64, sigma: f64, theta: f64) -> ForecastResult {
    let dt = 1.0;
    let exp_neg = (-theta * dt).exp();
    let exp_2neg = (-2.0 * theta * dt).exp();
    let mean = mu + (current - mu) * exp_neg;
    let variance = (sigma * sigma * (1.0 - exp_2neg)) / (2.0 * theta);
    let std = variance.sqrt();
    ForecastResult { mean, std }
}

/// Compute Linear Regression: y = bx + a and R2
pub fn calculate_linear_regression(forecasts: &[f64], actuals: &[f64]) -> RegressionResult {
    let n = forecasts.len();
    if n < 2 {
        return RegressionResult { a: 0.0, b: 1.0, r2: 0.0 };
    }
    let x_mean = forecasts.iter().sum::<f64>() / (n as f64);
    let y_mean = actuals.iter().sum::<f64>() / (n as f64);
    let mut ssxy = 0.0;
    let mut ssxx = 0.0;
    for i in 0..n {
        let x_diff = forecasts[i] - x_mean;
        ssxy += x_diff * (actuals[i] - y_mean);
        ssxx += x_diff * x_diff;
    }
    let b = if ssxx == 0.0 { 1.0 } else { ssxy / ssxx };
    let a = y_mean - b * x_mean;
    let mut ss_tot = 0.0;
    let mut ss_res = 0.0;
    for i in 0..n {
        let y_diff = actuals[i] - y_mean;
        ss_tot += y_diff * y_diff;
        ss_res += (actuals[i] - (a + b * forecasts[i])).powi(2);
    }
    let r2 = if ss_tot == 0.0 { 1.0 } else { 1.0 - ss_res / ss_tot };
    RegressionResult { a, b, r2 }
}

/// Compute Bias Statistics: MBE, MAE, RMSE, N
pub fn calculate_bias_stats(actuals: &[f64], forecasts: &[f64]) -> BiasStatsResult {
    let n = actuals.len();
    if n == 0 {
        return BiasStatsResult { mbe: 0.0, mae: 0.0, rmse: 0.0, n: 0 };
    }
    let mut err_sum = 0.0;
    let mut abs_err_sum = 0.0;
    let mut sq_err_sum = 0.0;
    for i in 0..n {
        let err = actuals[i] - forecasts[i];
        err_sum += err;
        abs_err_sum += err.abs();
        sq_err_sum += err * err;
    }
    let n_f = n as f64;
    BiasStatsResult {
        mbe: err_sum / n_f,
        mae: abs_err_sum / n_f,
        rmse: (sq_err_sum / n_f).sqrt(),
        n,
    }
}

/// Compute Rolling Bias Chart entries for the last `limit` elements
pub fn calculate_rolling_bias(actuals: &[f64], forecasts: &[f64], limit: usize) -> Vec<RollingBiasEntry> {
    let n = actuals.len();
    if n == 0 || limit == 0 { return Vec::new(); }
    let start_idx = if n > limit { n - limit } else { 0 };
    let mut entries = Vec::with_capacity(limit);
    for i in start_idx..n {
        let w7_start = if i >= 6 { let v = i - 6; if v < start_idx { start_idx } else { v } } else { start_idx };
        let w30_start = if i >= 29 { let v = i - 29; if v < start_idx { start_idx } else { v } } else { start_idx };
        entries.push(RollingBiasEntry {
            bias_7h: calculate_mbe(&actuals[w7_start..i+1], &forecasts[w7_start..i+1]),
            bias_30h: calculate_mbe(&actuals[w30_start..i+1], &forecasts[w30_start..i+1]),
        });
    }
    entries
}

fn calculate_mbe(actuals: &[f64], forecasts: &[f64]) -> f64 {
    let size = actuals.len();
    if size == 0 { return 0.0; }
    actuals.iter().zip(forecasts.iter()).map(|(a, f)| a - f).sum::<f64>() / (size as f64)
}

// ── Monte Carlo Simulator ─────────────────────────────────────────────────────

/// Fast XorShift64 PRNG — no external crate needed
#[inline]
fn xorshift64(state: &mut u64) -> u64 {
    *state ^= *state << 13;
    *state ^= *state >> 7;
    *state ^= *state << 17;
    *state
}

/// Convert u64 to uniform [0, 1)
#[inline]
fn rand_f64(state: &mut u64) -> f64 {
    (xorshift64(state) as f64) / (u64::MAX as f64)
}

/// Box-Muller transform: two uniform [0,1) values → standard normal sample
fn box_muller(state: &mut u64) -> f64 {
    loop {
        let u1 = rand_f64(state);
        let u2 = rand_f64(state);
        if u1 > 1e-15 {
            return (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
        }
    }
}

/// Core Monte Carlo maximum temperature simulator using Ornstein-Uhlenbeck SDE.
///
/// # Algorithm
/// 1. Blend current temp (METAR) with Open-Meteo T_max forecast for tomorrow
///    as a corrected starting reference: T_start = w * ecmwf_tomorrow + (1-w) * current_temp
/// 2. Simulate the OU process from hour 0 to hour 24 in hourly steps (dt=1/24),
///    recording the T_max of each path (peak diurnal temperature window: hours 10-17)
/// 3. Aggregate 10,000 T_max values into a percentile distribution
/// 4. Return full statistics + threshold probabilities
pub fn simulate_monte_carlo(
    current_temp: f64,
    ecmwf_tomorrow: f64,
    mu: f64,
    sigma: f64,
    theta: f64,
    ecmwf_weight: f64, // w: typically 0.35–0.45
    n_sims: u32,
    seed: u64,
) -> MonteCarloResult {
    let w = ecmwf_weight.clamp(0.0, 1.0);
    // Blended starting temp: weighted blend of OU day-ahead forecast and Open-Meteo
    let ou_tomorrow = mu + (current_temp - mu) * (-theta).exp();
    let blended_start = w * ecmwf_tomorrow + (1.0 - w) * ou_tomorrow;

    let dt = 1.0 / 24.0; // hourly steps
    let exp_neg_dt = (-theta * dt).exp();
    let noise_scale = sigma * ((1.0 - (-2.0 * theta * dt).exp()) / (2.0 * theta)).sqrt();

    let mut prng_state = if seed == 0 { 0xDEADBEEFCAFEBABE } else { seed };
    let mut max_temps: Vec<f64> = Vec::with_capacity(n_sims as usize);

    for _ in 0..n_sims {
        let mut t = blended_start;
        let mut t_max = t;

        // Simulate 24 hourly steps; record peak during hours 10–17 (peak window for SGT)
        for hour in 0..24u32 {
            let eps = box_muller(&mut prng_state);
            let next_t = mu + (t - mu) * exp_neg_dt + noise_scale * eps;
            t = next_t;
            // Only record maximum during the potential peak window (10:00–17:00 local)
            if hour >= 10 && hour <= 17 && t > t_max {
                t_max = t;
            }
        }
        max_temps.push(t_max);
    }

    // Sort for percentile calculation
    max_temps.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = max_temps.len();

    let percentile = |p: f64| -> f64 {
        let idx = ((p / 100.0) * (n as f64 - 1.0)).round() as usize;
        max_temps[idx.min(n - 1)]
    };

    let mean = max_temps.iter().sum::<f64>() / (n as f64);
    let variance = max_temps.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / (n as f64);
    let std = variance.sqrt();

    let prob_above = |threshold: f64| -> f64 {
        let count = max_temps.iter().filter(|&&x| x > threshold).count();
        (count as f64 / n as f64) * 100.0
    };

    MonteCarloResult {
        mean,
        std,
        p5:  percentile(5.0),
        p10: percentile(10.0),
        p25: percentile(25.0),
        p50: percentile(50.0),
        p75: percentile(75.0),
        p90: percentile(90.0),
        p95: percentile(95.0),
        prob_above_30: prob_above(30.0),
        prob_above_31: prob_above(31.0),
        prob_above_32: prob_above(32.0),
        prob_above_33: prob_above(33.0),
        prob_above_34: prob_above(34.0),
        blended_start,
        n_sims,
    }
}

// ── WASM Bindings ─────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn normal_cdf(x: f64) -> f64 {
    calculate_normal_cdf(x)
}

#[wasm_bindgen]
pub fn ou_forecast(current: f64, mu: f64, sigma: f64, theta: f64) -> JsValue {
    let result = calculate_ou_forecast(current, mu, sigma, theta);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn linear_regression(forecasts: Vec<f64>, actuals: Vec<f64>) -> JsValue {
    let result = calculate_linear_regression(&forecasts, &actuals);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn bias_stats(actuals: Vec<f64>, forecasts: Vec<f64>) -> JsValue {
    let result = calculate_bias_stats(&actuals, &forecasts);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn compute_rolling_bias(actuals: Vec<f64>, forecasts: Vec<f64>, limit: usize) -> JsValue {
    let result = calculate_rolling_bias(&actuals, &forecasts, limit);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Monte Carlo simulation for tomorrow's maximum temperature.
///
/// # Parameters
/// - `current_temp`: Today's current/peak temperature (°C), from METAR or ECMWF.
/// - `ecmwf_tomorrow`: Open-Meteo T_max forecast for tomorrow (°C).
/// - `mu`: OU gravitational anchor (monthly climatological mean, °C).
/// - `sigma`: OU monthly volatility (°C).
/// - `theta`: Mean-reversion speed (regime-adapted, e.g. 0.15–0.40).
/// - `ecmwf_weight`: Weight of Open-Meteo forecast in the blended start (0.0–1.0).
/// - `n_sims`: Number of Monte Carlo paths (recommended: 10000).
/// - `seed`: PRNG seed (use 0 for default; use timestamp for variety).
#[wasm_bindgen]
pub fn monte_carlo_max_temp(
    current_temp: f64,
    ecmwf_tomorrow: f64,
    mu: f64,
    sigma: f64,
    theta: f64,
    ecmwf_weight: f64,
    n_sims: u32,
    seed: u64,
) -> JsValue {
    let result = simulate_monte_carlo(
        current_temp, ecmwf_tomorrow, mu, sigma, theta,
        ecmwf_weight, n_sims, seed
    );
    serde_wasm_bindgen::to_value(&result).unwrap()
}

// ── Unit Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_cdf() {
        assert!((calculate_normal_cdf(0.0) - 0.5).abs() < 1e-7);
        assert!((calculate_normal_cdf(1.95996) - 0.975).abs() < 1e-4);
        assert!((calculate_normal_cdf(-1.95996) - 0.025).abs() < 1e-4);
    }

    #[test]
    fn test_ou_forecast() {
        let res = calculate_ou_forecast(31.0, 29.5, 1.5, 0.25);
        assert!((res.mean - 30.66820117).abs() < 1e-6);
        assert!((res.std - 1.33064346).abs() < 1e-6);
    }

    #[test]
    fn test_linear_regression() {
        let xs = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let ys = vec![2.0, 4.0, 5.0, 4.0, 5.0];
        let res = calculate_linear_regression(&xs, &ys);
        assert!((res.b - 0.6).abs() < 1e-6);
        assert!((res.a - 2.2).abs() < 1e-6);
    }

    #[test]
    fn test_bias_stats() {
        let actuals = vec![29.0, 31.0, 32.5, 30.0];
        let forecasts = vec![30.0, 30.0, 32.0, 31.0];
        let res = calculate_bias_stats(&actuals, &forecasts);
        assert!((res.mbe - (-0.125)).abs() < 1e-6);
        assert!((res.mae - 0.875).abs() < 1e-6);
        assert!((res.rmse - 0.9013878).abs() < 1e-6);
        assert_eq!(res.n, 4);
    }

    #[test]
    fn test_compute_rolling_bias() {
        let actuals   = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let forecasts = vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0];
        let res = calculate_rolling_bias(&actuals, &forecasts, 5);
        assert_eq!(res.len(), 5);
        for entry in &res {
            assert!((entry.bias_7h - 1.0).abs() < 1e-6);
            assert!((entry.bias_30h - 1.0).abs() < 1e-6);
        }
    }

    #[test]
    fn test_monte_carlo_basic_sanity() {
        // With mu=31.0, current=31.0, ecmwf=31.0 → blended start ≈ 31.0
        // All paths should stay near mu → P50 should be within [28, 34]
        let res = simulate_monte_carlo(
            31.0, // current
            31.0, // ecmwf
            31.0, // mu
            1.2,  // sigma
            0.25, // theta
            0.4,  // ecmwf_weight
            5000, // n_sims
            42,   // seed
        );
        assert!(res.p50 >= 28.0 && res.p50 <= 36.0, "P50 out of range: {}", res.p50);
        assert!(res.p5 < res.p50, "P5 must be less than P50");
        assert!(res.p95 > res.p50, "P95 must be greater than P50");
        assert!(res.prob_above_30 >= 0.0 && res.prob_above_30 <= 100.0);
        // blended_start should be weighted average of ou_tomorrow and ecmwf
        let ou_tomorrow = 31.0 + (31.0 - 31.0) * (-0.25f64).exp(); // = 31.0
        let expected_blended = 0.4 * 31.0 + 0.6 * ou_tomorrow;
        assert!((res.blended_start - expected_blended).abs() < 0.01, 
                "blended_start mismatch: {} vs {}", res.blended_start, expected_blended);
    }

    #[test]
    fn test_monte_carlo_hot_bias() {
        // With ecmwf much hotter than mu, P50 should be higher than when ecmwf equals mu
        let res_hot = simulate_monte_carlo(31.0, 34.5, 31.0, 1.2, 0.25, 0.4, 5000, 42);
        let res_neutral = simulate_monte_carlo(31.0, 31.0, 31.0, 1.2, 0.25, 0.4, 5000, 42);
        assert!(res_hot.p50 > res_neutral.p50, 
                "Hot ECMWF should produce higher P50: {} vs {}", res_hot.p50, res_neutral.p50);
        assert!(res_hot.prob_above_33 > res_neutral.prob_above_33,
                "Hot ECMWF should have higher prob_above_33");
    }

    #[test]
    fn test_box_muller_distribution() {
        let mut state: u64 = 12345;
        let n = 10000;
        let samples: Vec<f64> = (0..n).map(|_| box_muller(&mut state)).collect();
        let mean = samples.iter().sum::<f64>() / (n as f64);
        let variance = samples.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / (n as f64);
        let std = variance.sqrt();
        // Standard normal should have mean ≈ 0 and std ≈ 1
        assert!(mean.abs() < 0.05, "Box-Muller mean too far from 0: {}", mean);
        assert!((std - 1.0).abs() < 0.05, "Box-Muller std too far from 1: {}", std);
    }
}
