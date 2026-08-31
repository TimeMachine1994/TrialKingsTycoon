/**
 * All money in the app is stored as integer MICRO-DOLLARS (µ$).
 * $1.00 = 1_000_000 µ$. This allows exact sub-penny unit costs
 * (e.g. $0.0032/sheet = 3_200 µ$) with pure integer math.
 */

export const MICRO = 1_000_000;

/** Parse a user-entered dollar string ("1,234.56", "$0.0032") into micro-dollars. */
export function parseMoney(input: string | number): number {
	if (typeof input === 'number') {
		return Math.round(input * MICRO);
	}
	const cleaned = input.replace(/[$,\s]/g, '');
	if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
	const value = Number(cleaned);
	if (!Number.isFinite(value)) {
		throw new Error(`Invalid money value: "${input}"`);
	}
	return Math.round(value * MICRO);
}

/** Format micro-dollars as a display string rounded to cents, e.g. "$1,234.56". */
export function fmtMoney(micro: number): string {
	const negative = micro < 0;
	const cents = Math.round(Math.abs(micro) / 10_000);
	const dollars = Math.floor(cents / 100);
	const rem = cents % 100;
	const dollarStr = dollars.toLocaleString('en-US');
	return `${negative ? '-' : ''}$${dollarStr}.${String(rem).padStart(2, '0')}`;
}

/** Format a per-unit cost with sub-penny precision (up to 4 decimals), e.g. "$0.0032". */
export function fmtUnitCost(micro: number): string {
	const negative = micro < 0;
	const abs = Math.abs(micro);
	const value = abs / MICRO;
	let str: string;
	if (abs !== 0 && abs % 10_000 !== 0) {
		str = value.toFixed(4);
	} else {
		str = value.toFixed(2);
	}
	return `${negative ? '-' : ''}$${str}`;
}

/** Integer division with round-half-up (used for cost allocation & averaging). */
export function divRound(numerator: number, denominator: number): number {
	if (denominator === 0) return 0;
	const sign = Math.sign(numerator) * Math.sign(denominator) || 1;
	const n = Math.abs(numerator);
	const d = Math.abs(denominator);
	return sign * Math.floor((n + d / 2) / d);
}

/**
 * Allocate `total` (µ$) across weights proportionally, distributing rounding
 * remainders so the parts always sum exactly to `total`.
 */
export function allocate(total: number, weights: number[]): number[] {
	const weightSum = weights.reduce((a, b) => a + b, 0);
	if (weightSum <= 0 || weights.length === 0) {
		// even split fallback
		const n = weights.length || 1;
		const base = Math.floor(total / n);
		const parts = new Array(weights.length).fill(base);
		let rem = total - base * weights.length;
		for (let i = 0; rem !== 0 && i < parts.length; i++) {
			parts[i] += Math.sign(rem);
			rem -= Math.sign(rem);
		}
		return parts;
	}
	const parts = weights.map((w) => Math.floor((total * w) / weightSum));
	let rem = total - parts.reduce((a, b) => a + b, 0);
	// hand out remainder cents-of-micro to largest weights first
	const order = weights
		.map((w, i) => ({ w, i }))
		.sort((a, b) => b.w - a.w)
		.map((x) => x.i);
	for (let k = 0; rem > 0; k = (k + 1) % order.length) {
		parts[order[k]] += 1;
		rem -= 1;
	}
	return parts;
}
