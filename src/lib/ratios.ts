/**
 * Inventory efficiency ratios. Inputs are integer micro-dollars / base units;
 * outputs are display-only floats (never stored), so plain division is fine.
 * `null` means "not computable yet" and should render as "—".
 */
import { divRound } from './money';

export type RatioConfidence = 'low' | 'medium' | 'ok';

/** Mean of end-of-period inventory values (µ$). */
export function averageInventory(points: number[]): number {
	if (points.length === 0) return 0;
	return divRound(points.reduce((a, b) => a + b, 0), points.length);
}

/** COGS ÷ average inventory for the same period. */
export function turnover(cogs: number, avgInventory: number): number | null {
	if (avgInventory <= 0) return null;
	return cogs / avgInventory;
}

/** Days of stock on hand implied by a per-period turnover. */
export function daysInventory(turnoverPerPeriod: number | null, daysInPeriod: number): number | null {
	if (turnoverPerPeriod === null || turnoverPerPeriod <= 0) return null;
	return daysInPeriod / turnoverPerPeriod;
}

/** Months the current stock lasts at the average monthly consumption. */
export function monthsOfSupply(qtyOnHand: number, avgMonthlyUsage: number): number | null {
	if (avgMonthlyUsage <= 0) return null;
	return Math.max(qtyOnHand, 0) / avgMonthlyUsage;
}

/** Share of consumed material that was wasted, 0..1. */
export function wastePct(waste: number, used: number): number | null {
	const total = waste + used;
	if (total <= 0) return null;
	return waste / total;
}

/** How much to trust time-based ratios given N distinct months of job data. */
export function ratioConfidence(dataMonths: number): RatioConfidence {
	if (dataMonths < 2) return 'low';
	if (dataMonths < 3) return 'medium';
	return 'ok';
}

export function fmtPct(value: number | null, digits = 1): string {
	return value === null ? '—' : `${(value * 100).toFixed(digits)}%`;
}

export function fmtRatio(value: number | null, digits = 2, suffix = ''): string {
	return value === null ? '—' : `${value.toFixed(digits)}${suffix}`;
}
