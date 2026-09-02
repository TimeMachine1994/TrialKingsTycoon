import { computeBreakEven, monthlyFixed } from '$lib/breakeven';
import {
	actualsSummary,
	createScenario,
	deleteScenario,
	duplicateScenario,
	listCosts,
	listScenarios,
	setActiveScenario
} from '$lib/server/services/planner';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const scenarios = listScenarios().map((s) => {
		const { fixedMonthly, oneTimeTotal } = monthlyFixed(listCosts(s.id));
		const be = computeBreakEven({
			fixedMonthly,
			oneTimeTotal,
			variableCostRate: s.variable_cost_rate,
			avgJobValue: s.avg_job_value,
			hoursPerJob: s.hours_per_job,
			hourlyRate: s.hourly_rate,
			jobsPerMonth: s.jobs_per_month,
			jobsGrowthRate: s.jobs_growth_rate,
			targetProfit: s.target_profit
		});
		return { ...s, fixedMonthly, oneTimeTotal, be };
	});
	return { scenarios, actuals: actualsSummary() };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Scenario name is required' });
		const id = createScenario(name, String(form.get('notes') ?? '').trim() || null);
		throw redirect(303, `/planner/${id}`);
	},

	duplicate: async ({ request }) => {
		const form = await request.formData();
		try {
			const id = duplicateScenario(Number(form.get('id')));
			throw redirect(303, `/planner/${id}`);
		} catch (e) {
			if (e instanceof Error) return fail(400, { error: e.message });
			throw e;
		}
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		try {
			deleteScenario(Number(form.get('id')));
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to delete' });
		}
		return { success: true };
	},

	setActive: async ({ request }) => {
		const form = await request.formData();
		setActiveScenario(Number(form.get('id')));
		return { success: true };
	}
};
