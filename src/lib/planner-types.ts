/** Shared (client-safe) enums for the overhead planner. */

export const COST_CATEGORIES = [
	'rent',
	'utilities',
	'software',
	'insurance',
	'equipment',
	'marketing',
	'labor',
	'other'
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_CADENCES = ['monthly', 'yearly', 'one_time'] as const;
export type CostCadence = (typeof COST_CADENCES)[number];

export const CADENCE_LABEL: Record<CostCadence, string> = {
	monthly: '/ month',
	yearly: '/ year',
	one_time: 'one-time'
};

export function isCostCategory(v: unknown): v is CostCategory {
	return typeof v === 'string' && (COST_CATEGORIES as readonly string[]).includes(v);
}

export function isCostCadence(v: unknown): v is CostCadence {
	return typeof v === 'string' && (COST_CADENCES as readonly string[]).includes(v);
}
