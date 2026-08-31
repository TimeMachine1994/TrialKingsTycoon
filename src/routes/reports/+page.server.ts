import { inventoryValuation, salesVsCogsByMonth, wasteByProduct } from '$lib/server/services/reports';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return {
		periods: salesVsCogsByMonth(),
		waste: wasteByProduct(),
		valuation: inventoryValuation()
	};
};
