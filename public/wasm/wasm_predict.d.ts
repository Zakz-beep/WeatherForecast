/* tslint:disable */
/* eslint-disable */

export function bias_stats(actuals: Float64Array, forecasts: Float64Array): any;

export function compute_rolling_bias(actuals: Float64Array, forecasts: Float64Array, limit: number): any;

export function linear_regression(forecasts: Float64Array, actuals: Float64Array): any;

export function normal_cdf(x: number): number;

export function ou_forecast(current: number, mu: number, sigma: number, theta: number): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly bias_stats: (a: number, b: number, c: number, d: number) => any;
    readonly compute_rolling_bias: (a: number, b: number, c: number, d: number, e: number) => any;
    readonly linear_regression: (a: number, b: number, c: number, d: number) => any;
    readonly normal_cdf: (a: number) => number;
    readonly ou_forecast: (a: number, b: number, c: number, d: number) => any;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
