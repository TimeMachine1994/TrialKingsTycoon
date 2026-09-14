/**
 * Break-even / contribution-margin math for the overhead planner.
 * Money in integer micro-dollars, rates as RATE_SCALE (percent × 10,000).
 * Client-safe: no server imports.
 */
import { divRound, RATE_SCALE, taxFromRate } from './money';
import type { CostCadence } from './planner-types';

export interface CostLineLike {
	amount: number;
	cadence: CostCadence | string;
	enabled: number | boolean;
}

export interface ScenarioInputs {
	fixedMonthly: number;
	oneTimeTotal: number;
	variableCostRate: number;
	avgJobValue: number;
	hoursPerJob: number;
	hourlyRate: number;
	jobsPerMonth: number;
	jobsGrowthRate: number;
	targetProfit: number;
}

export interface BreakEven {
	laborPerJob: number;
	materialsPerJob: number;
	contributionPerJob: number;
	contributionRate: number | null;
	breakEvenRevenue: number | null;
	breakEvenJobs: number | null;
	targetJobs: number | null;
	projectedNet: number;
	paybackMonths: number | null;
}

export interface ProjectionRow {
	month: number;
	jobs: number;
	revenue: number;
	variableCost: number;
	labor: number;
	fixed: number;
	net: number;
	cumulative: number;
}

/** Enabled monthly + yearly/12 lines → fixed µ$/month; one-time lines summed separately. */
export function monthlyFixed(lines: CostLineLike[]): { fixedMonthly: number; oneTimeTotal: number } {
	let fixedMonthly = 0;
	let oneTimeTotal = 0;
	for (const l of lines) {
		if (!l.enabled) continue;
		if (l.cadence === 'monthly') fixedMonthly += l.amount;
		else if (l.cadence === 'yearly') fixedMonthly += divRound(l.amount, 12);
		else if (l.cadence === 'one_time') oneTimeTotal += l.amount;
	}
	return { fixedMonthly, oneTimeTotal };
}

export function laborPerJob(hoursPerJob: number, hourlyRate: number): number {
	return Math.round(hoursPerJob * hourlyRate);
}

export function computeBreakEven(i: ScenarioInputs): BreakEven {
	const labor = laborPerJob(i.hoursPerJob, i.hourlyRate);
	const materials = taxFromRate(i.avgJobValue, i.variableCostRate);
	const contribution = i.avgJobValue - materials - labor;
	const contributionRate = i.avgJobValue > 0 ? contribution / i.avgJobValue : null;
	const positive = contribution > 0;

	const breakEvenJobs = positive ? Math.ceil(i.fixedMonthly / contribution) : null;
	const breakEvenRevenue =
		contributionRate !== null && contributionRate > 0 ? divRound(i.fixedMonthly, contributionRate) : null;
	const targetJobs = positive ? Math.ceil((i.fixedMonthly + i.targetProfit) / contribution) : null;
	const projectedNet = Math.round(i.jobsPerMonth * contribution) - i.fixedMonthly;
	const paybackMonths = projectedNet > 0 && i.oneTimeTotal > 0 ? i.oneTimeTotal / projectedNet : i.oneTimeTotal === 0 ? 0 : null;

	return {
		laborPerJob: labor,
		materialsPerJob: materials,
		contributionPerJob: contribution,
		contributionRate,
		breakEvenRevenue,
		breakEvenJobs,
		targetJobs,
		projectedNet,
		paybackMonths
	};
}

/** Month-by-month projection; jobs compound by growth rate, cumulative starts at −oneTimeTotal. */
export function project(i: ScenarioInputs, months = 12): ProjectionRow[] {
	const labor = laborPerJob(i.hoursPerJob, i.hourlyRate);
	const growth = 1 + i.jobsGrowthRate / (100 * RATE_SCALE);
	const rows: ProjectionRow[] = [];
	let jobs = i.jobsPerMonth;
	let cumulative = -i.oneTimeTotal;
	for (let m = 1; m <= months; m++) {
		const revenue = Math.round(jobs * i.avgJobValue);
		const variableCost = taxFromRate(revenue, i.variableCostRate);
		const laborCost = Math.round(jobs * labor);
		const net = revenue - variableCost - laborCost - i.fixedMonthly;
		cumulative += net;
		rows.push({ month: m, jobs, revenue, variableCost, labor: laborCost, fixed: i.fixedMonthly, net, cumulative });
		jobs *= growth;
	}
	return rows;
}

/** First month whose cumulative position is ≥ 0, or null. */
export function breakEvenMonth(rows: ProjectionRow[]): number | null {
	return rows.find((r) => r.cumulative >= 0)?.month ?? null;
}

export interface ActualsSummary {
	sales: number;
	used: number;
	waste: number;
	jobCount: number;
	months: number;
}

/** Derive default scenario assumptions from recorded jobs. */
export function actualsToInputs(
	a: ActualsSummary
): Pick<ScenarioInputs, 'variableCostRate' | 'avgJobValue' | 'jobsPerMonth'> {
	const variableCostRate = a.sales > 0 ? Math.round(((a.used + a.waste) / a.sales) * 100 * RATE_SCALE) : 0;
	const avgJobValue = a.jobCount > 0 ? divRound(a.sales, a.jobCount) : 0;
	const jobsPerMonth = a.months > 0 ? a.jobCount / a.months : 0;
	return { variableCostRate, avgJobValue, jobsPerMonth };
}
