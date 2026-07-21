use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

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

// ── Pure Rust Implementations (can be tested on any target) ───────────────────

pub fn calculate_normal_cdf(x: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.2316419 * x.abs());
    let d = 0.3989422820 * (-0.5 * x * x).exp();
    let poly = t * (0.3193815302 +
               t * (-0.3565637813 +
               t * (1.7814779372 +
               t * (-1.8212559978 + t * 1.3302744929))));
    let cdf = 1.0 - d * poly;
    if x >= 0.0 {
        cdf
    } else {
        1.0 - cdf
    }
}

pub fn calculate_ou_forecast(current: f64, mu: f64, sigma: f64, theta: f64) -> ForecastResult {
    let dt = 1.0; // 1 day
    let exp_neg = (-theta * dt).exp();
    let exp_2neg = (-2.0 * theta * dt).exp();
    let mean = mu + (current - mu) * exp_neg;
    let variance = (sigma * sigma * (1.0 - exp_2neg)) / (2.0 * theta);
    let std = variance.sqrt();
    ForecastResult { mean, std }
}

pub fn calculate_linear_regression(forecasts: &[f64], actuals: &[f64]) -> RegressionResult {
    let n = forecasts.len();
    if n < 2 {
        return RegressionResult { a: 0.0, b: 1.0, r2: 0.0 };
    }
    
    let x_sum: f64 = forecasts.iter().sum();
    let y_sum: f64 = actuals.iter().sum();
    let x_mean = x_sum / (n as f64);
    let y_mean = y_sum / (n as f64);
    
    let mut ssxy = 0.0;
    let mut ssxx = 0.0;
    for i in 0..n {
        let x_diff = forecasts[i] - x_mean;
        let y_diff = actuals[i] - y_mean;
        ssxy += x_diff * y_diff;
        ssxx += x_diff * x_diff;
    }
    
    let b = if ssxx == 0.0 { 1.0 } else { ssxy / ssxx };
    let a = y_mean - b * x_mean;
    
    let mut ss_tot = 0.0;
    let mut ss_res = 0.0;
    for i in 0..n {
        let y_diff = actuals[i] - y_mean;
        ss_tot += y_diff * y_diff;
        
        let pred = a + b * forecasts[i];
        let res_diff = actuals[i] - pred;
        ss_res += res_diff * res_diff;
    }
    
    let r2 = if ss_tot == 0.0 { 1.0 } else { 1.0 - (ss_res / ss_tot) };
    
    RegressionResult { a, b, r2 }
}

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
    
    let mbe = err_sum / (n as f64);
    let mae = abs_err_sum / (n as f64);
    let rmse = (sq_err_sum / (n as f64)).sqrt();
    
    BiasStatsResult { mbe, mae, rmse, n }
}

pub fn calculate_rolling_bias(actuals: &[f64], forecasts: &[f64], limit: usize) -> Vec<RollingBiasEntry> {
    let n = actuals.len();
    if n == 0 || limit == 0 {
        return Vec::new();
    }
    
    let start_idx = if n > limit { n - limit } else { 0 };
    let mut entries = Vec::with_capacity(limit);
    
    for i in start_idx..n {
        let w7_start = if i >= 6 {
            let val = i - 6;
            if val < start_idx { start_idx } else { val }
        } else {
            start_idx
        };
        let w7_end = i + 1;
        
        let w30_start = if i >= 29 {
            let val = i - 29;
            if val < start_idx { start_idx } else { val }
        } else {
            start_idx
        };
        let w30_end = i + 1;
        
        let mbe_7h = calculate_mbe(&actuals[w7_start..w7_end], &forecasts[w7_start..w7_end]);
        let mbe_30h = calculate_mbe(&actuals[w30_start..w30_end], &forecasts[w30_start..w30_end]);
        
        entries.push(RollingBiasEntry {
            bias_7h: mbe_7h,
            bias_30h: mbe_30h,
        });
    }
    entries
}

fn calculate_mbe(actuals: &[f64], forecasts: &[f64]) -> f64 {
    let size = actuals.len();
    if size == 0 {
        return 0.0;
    }
    let sum: f64 = actuals.iter().zip(forecasts.iter()).map(|(a, f)| a - f).sum();
    sum / (size as f64)
}

// ── WASM Bindings (thin wrapper functions returning JsValue) ──────────────────

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

// ── Unit Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_cdf() {
        let cdf_zero = calculate_normal_cdf(0.0);
        assert!((cdf_zero - 0.5).abs() < 1e-7);

        let cdf_one_ninety_six = calculate_normal_cdf(1.95996);
        assert!((cdf_one_ninety_six - 0.975).abs() < 1e-4);

        let cdf_neg_one_ninety_six = calculate_normal_cdf(-1.95996);
        assert!((cdf_neg_one_ninety_six - 0.025).abs() < 1e-4);
    }

    #[test]
    fn test_ou_forecast() {
        let current: f64 = 31.0;
        let mu: f64 = 29.5;
        let sigma: f64 = 1.5;
        let theta: f64 = 0.25;
        
        let res = calculate_ou_forecast(current, mu, sigma, theta);
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
        assert!(res.r2 >= 0.0 && res.r2 <= 1.0);
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
        let actuals = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let forecasts = vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0];
        
        let res = calculate_rolling_bias(&actuals, &forecasts, 5);
        assert_eq!(res.len(), 5);
        for entry in res {
            assert!((entry.bias_7h - 1.0).abs() < 1e-6);
            assert!((entry.bias_30h - 1.0).abs() < 1e-6);
        }
    }
}
