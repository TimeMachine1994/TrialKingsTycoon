import { computeBreakEven, monthlyFixed, project } from '$lib/breakeven';
import { actualsSummary, getScenario, listScenarios } from '$lib/server/services/planner';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const ids = (url.searchParams.get('ids') ?? '')
		.split(',')
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0)
		.slice(0, 4);

	const columns = ids
		.map((id) => getScenario(id))
		.filter((s): s is NonNullable<typeof s> => !!s)
		.map((s) => {
			const { fixedMonthly, oneTimeTotal } = monthlyFixed(s.costs);
			const inputs = {
				fixedMonthly,
				oneTimeTotal,
				variableCostRate: s.variable_cost_rate,
				avgJobValue: s.avg_job_value,
				hoursPerJob: s.hours_per_job,
				hourlyRate: s.hourly_rate,
				jobsPerMonth: s.jobs_per_month,
				jobsGrowthRate: s.jobs_growth_rate,
				targetProfit: s.target_profit
			};
			const rows = project(inputs);
			return {
				id: s.id,
				name: s.name,
				is_active: s.is_active,
				inputs,
				be: computeBreakEven(inputs),
				cumulative12: rows[rows.length - 1]?.cumulative ?? 0
			};
		});

	return { columns, ids, all: listScenarios(), actuals: actualsSummary() };
};
