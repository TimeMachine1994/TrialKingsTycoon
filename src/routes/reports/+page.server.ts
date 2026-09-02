import {
	activeScenarioOverhead,
	efficiencySummary,
	inventoryValuation,
	marginByClient,
	marginByJob,
	overheadForPeriod,
	salesVsCogsByMonth,
	wasteByProduct
} from '$lib/server/services/reports';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const overhead = activeScenarioOverhead();
	const periods = salesVsCogsByMonth().map((p) => ({
		...p,
		labor: overhead ? p.job_count * overhead.laborPerJob : 0,
		overhead: overhead ? overheadForPeriod(overhead.fixedMonthly, p.period) : 0
	}));
	return {
		periods,
		overhead,
		waste: wasteByProduct(),
		valuation: inventoryValuation(),
		efficiency: efficiencySummary(),
		marginJobs: marginByJob(),
		marginClients: marginByClient()
	};
};
