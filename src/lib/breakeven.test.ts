import { describe, expect, it } from 'vitest';
import {
	actualsToInputs,
	breakEvenMonth,
	computeBreakEven,
	monthlyFixed,
	project,
	type ScenarioInputs
} from './breakeven';
import { parseMoney, parseRate } from './money';

const base: ScenarioInputs = {
	fixedMonthly: parseMoney('1500'),
	oneTimeTotal: 0,
	variableCostRate: parseRate('60'),
	avgJobValue: parseMoney('160'),
	hoursPerJob: 1.5,
	hourlyRate: parseMoney('25'),
	jobsPerMonth: 10,
	jobsGrowthRate: 0,
	targetProfit: 0
};

describe('monthlyFixed', () => {
	it('sums monthly, spreads yearly, separates one-time, skips disabled', () => {
		const r = monthlyFixed([
			{ amount: parseMoney('1200'), cadence: 'monthly', enabled: 1 },
			{ amount: parseMoney('600'), cadence: 'yearly', enabled: true },
			{ amount: parseMoney('3000'), cadence: 'one_time', enabled: 1 },
			{ amount: parseMoney('999'), cadence: 'monthly', enabled: 0 }
		]);
		expect(r.fixedMonthly).toBe(parseMoney('1250'));
		expect(r.oneTimeTotal).toBe(parseMoney('3000'));
	});
	it('rounds yearly/12 half up', () => {
		expect(monthlyFixed([{ amount: 13, cadence: 'yearly', enabled: 1 }]).fixedMonthly).toBe(1);
	});
});

describe('computeBreakEven', () => {
	it('hand-checked example', () => {
		const r = computeBreakEven(base);
		expect(r.materialsPerJob).toBe(parseMoney('96'));
		expect(r.laborPerJob).toBe(parseMoney('37.50'));
		expect(r.contributionPerJob).toBe(parseMoney('26.50'));
		expect(r.contributionRate).toBeCloseTo(0.165625, 6);
		expect(r.breakEvenJobs).toBe(57); // 1500 / 26.5 = 56.6
		expect(r.breakEvenRevenue).toBe(Math.round(parseMoney('1500') / 0.165625));
		expect(r.projectedNet).toBe(parseMoney('265') - parseMoney('1500'));
		expect(r.paybackMonths).toBe(0);
	});
	it('target profit raises required jobs', () => {
		expect(computeBreakEven({ ...base, targetProfit: parseMoney('530') }).targetJobs).toBe(77);
	});
	it('null guards when contribution is non-positive', () => {
		const r = computeBreakEven({ ...base, variableCostRate: parseRate('100') });
		expect(r.breakEvenJobs).toBeNull();
		expect(r.breakEvenRevenue).toBeNull();
		expect(r.targetJobs).toBeNull();
	});
	it('null guard when avg job value is zero', () => {
		expect(computeBreakEven({ ...base, avgJobValue: 0 }).contributionRate).toBeNull();
	});
	it('payback null when net is not positive, computed otherwise', () => {
		expect(computeBreakEven({ ...base, oneTimeTotal: parseMoney('1000') }).paybackMonths).toBeNull();
		const r = computeBreakEven({ ...base, oneTimeTotal: parseMoney('1000'), jobsPerMonth: 100 });
		expect(r.projectedNet).toBe(parseMoney('1150'));
		expect(r.paybackMonths).toBeCloseTo(1000 / 1150, 6);
	});
});

describe('project', () => {
	it('produces 12 rows starting from -oneTime', () => {
		const rows = project({ ...base, oneTimeTotal: parseMoney('100') });
		expect(rows).toHaveLength(12);
		expect(rows[0].cumulative).toBe(-parseMoney('100') + rows[0].net);
		expect(rows[0].net).toBe(parseMoney('265') - parseMoney('1500'));
	});
	it('compounds jobs by growth rate', () => {
		const rows = project({ ...base, jobsGrowthRate: parseRate('10') }, 3);
		expect(rows[1].jobs).toBeCloseTo(11, 9);
		expect(rows[2].jobs).toBeCloseTo(12.1, 9);
	});
	it('cumulative is a running sum of nets', () => {
		const rows = project(base, 4);
		const sum = rows.reduce((a, r) => a + r.net, 0);
		expect(rows[3].cumulative).toBe(sum);
	});
	it('breakEvenMonth finds first non-negative cumulative', () => {
		const rows = project({ ...base, oneTimeTotal: parseMoney('2000'), jobsPerMonth: 100 });
		expect(breakEvenMonth(rows)).toBe(2); // 1150/mo net vs 2000 up-front
		expect(breakEvenMonth(project(base))).toBeNull();
	});
});

describe('actualsToInputs', () => {
	it('derives defaults from real numbers', () => {
		const r = actualsToInputs({
			sales: parseMoney('320.54'),
			used: 191_551_534,
			waste: 0,
			jobCount: 2,
			months: 1
		});
		expect(r.variableCostRate).toBe(597_590); // 59.7590%
		expect(r.avgJobValue).toBe(parseMoney('160.27'));
		expect(r.jobsPerMonth).toBe(2);
	});
	it('zero-safe', () => {
		expect(actualsToInputs({ sales: 0, used: 0, waste: 0, jobCount: 0, months: 0 })).toEqual({
			variableCostRate: 0,
			avgJobValue: 0,
			jobsPerMonth: 0
		});
	});
});
