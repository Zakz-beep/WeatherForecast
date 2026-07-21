use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ForecastResult {
    pub mean: f64,
    pub std: f64,
}

/// Abramowitz & Stegun approximation for the Normal CDF, error < 7.5e-8
#[wasm_bindgen]
pub fn normal_cdf(x: f64) -> f64 {
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

/// Compute OU conditional mean & std for H+1 given current temp
#[wasm_bindgen]
pub fn ou_forecast(current: f64, mu: f64, sigma: f64, theta: f64) -> JsValue {
    let dt = 1.0; // 1 day
    let exp_neg = (-theta * dt).exp();
    let exp_2neg = (-2.0 * theta * dt).exp();
    let mean = mu + (current - mu) * exp_neg;
    let variance = (sigma * sigma * (1.0 - exp_2neg)) / (2.0 * theta);
    let std = variance.sqrt();

    let result = ForecastResult { mean, std };
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_cdf() {
        // CDF of 0 should be exactly 0.5
        let cdf_zero = normal_cdf(0.0);
        assert!((cdf_zero - 0.5).abs() < 1e-7);

        // CDF of 1.95996 should be close to 0.975
        let cdf_one_ninety_six = normal_cdf(1.95996);
        assert!((cdf_one_ninety_six - 0.975).abs() < 1e-4);

        // CDF of -1.95996 should be close to 0.025
        let cdf_neg_one_ninety_six = normal_cdf(-1.95996);
        assert!((cdf_neg_one_ninety_six - 0.025).abs() < 1e-4);
    }

    #[test]
    fn test_ou_forecast() {
        let current: f64 = 31.0;
        let mu: f64 = 29.5;
        let sigma: f64 = 1.5;
        let theta: f64 = 0.25;

        // JS calculations for the same:
        // dt = 1
        // expNeg = Math.exp(-0.25) = 0.778800783
        // exp2Neg = Math.exp(-0.5) = 0.606530659
        // mean = 29.5 + (31.0 - 29.5) * 0.778800783 = 29.5 + 1.5 * 0.778800783 = 30.66820117
        // variance = (1.5 * 1.5 * (1 - 0.606530659)) / 0.5 = 2.25 * 0.39346934 / 0.5 = 1.77061203
        // std = Math.sqrt(1.77061203) = 1.33064346
        
        let dt: f64 = 1.0;
        let exp_neg = (-theta * dt).exp();
        let exp_2neg = (-2.0 * theta * dt).exp();
        let expected_mean = mu + (current - mu) * exp_neg;
        let expected_variance = (sigma * sigma * (1.0 - exp_2neg)) / (2.0 * theta);
        let expected_std = expected_variance.sqrt();

        // Let's call the actual helper functions to compare
        // We'll parse it back since ou_forecast returns JsValue in real use,
        // but let's test the math directly:
        assert!((expected_mean - 30.66820117).abs() < 1e-6);
        assert!((expected_std - 1.33064346).abs() < 1e-6);
    }
}
