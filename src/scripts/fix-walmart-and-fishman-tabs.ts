/**
 * One-off data fix (run after the Staples/Amazon/Fishman imports):
 *
 * 1. Update Walmart receipt 623640029123 (2026-08-24) in place: it was
 *    hand-entered with no tax and a bogus $0 binder line. Real print-related
 *    lines: 10 boxes binder clips @ $1.97, printable vinyl 25-sheet pack $9.84,
 *    8-tab divider bag $2.42; FL tax 6.5%.
 * 2. Job Fishman082426 "Generic Tabs" were the Walmart 8-tab dividers, not the
 *    Staples legal index sets: swap that material line.
 * 3. Vinyl sticker sheet lines on both Fishman jobs were snapshotted at $0
 *    cost (no receipt existed yet): re-add them so they pick up the real cost.
 *
 *   npx vite-node src/scripts/fix-walmart-and-fishman-tabs.ts
 */
import { db, type JobMaterial, type Product, type Receipt } from '$lib/server/db';
import { addJobMaterial, removeJobMaterial } from '$lib/server/services/jobs';
import { updateReceipt } from '$lib/server/services/receipts';
import { parseMoney, parseRate, taxFromRate } from '$lib/money';

const WALMART_REF = '623640029123';
const P = { clips: 3, binder1in: 4, vinyl: 5, tabs8: 6, indexTabs: 8 } as const;

function product(id: number): Product {
	const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
	if (!p) throw new Error(`Product #${id} missing`);
	return p;
}

function ensureConversion(productId: number, unitName: string, per: number): void {
	const row = db
		.prepare('SELECT id FROM unit_conversions WHERE product_id = ? AND unit_name = ?')
		.get(productId, unitName);
	if (!row) {
		db.prepare('INSERT INTO unit_conversions (product_id, unit_name, base_units_per) VALUES (?, ?, ?)').run(
			productId, unitName, per
		);
	}
}

const run = db.transaction(() => {
	// ---- 1. Walmart receipt ----
	const receipt = db.prepare('SELECT * FROM receipts WHERE ref_number = ?').get(WALMART_REF) as
		| Receipt
		| undefined;
	if (!receipt) throw new Error(`Walmart receipt ${WALMART_REF} not found`);

	ensureConversion(P.vinyl, 'pack (25)', 25);
	ensureConversion(P.tabs8, 'bag (8)', 8);

	const lines = [
		{ product_id: P.clips, unit_name: 'box (12)', base_units_per: 12, qty_purchased: 10, line_cost: parseMoney('19.70') },
		{ product_id: P.vinyl, unit_name: 'pack (25)', base_units_per: 25, qty_purchased: 1, line_cost: parseMoney('9.84') },
		{ product_id: P.tabs8, unit_name: 'bag (8)', base_units_per: 8, qty_purchased: 1, line_cost: parseMoney('2.42') }
	];
	const rate = parseRate('6.5');
	const subtotal = lines.reduce((a, l) => a + l.line_cost, 0);
	const alreadyFixed = receipt.tax_rate === rate && receipt.subtotal === subtotal;
	if (alreadyFixed) {
		console.log(`Walmart receipt #${receipt.id} already fixed, skipping`);
	} else {
		updateReceipt(receipt.id, {
			vendor_id: receipt.vendor_id,
			ref_number: receipt.ref_number,
			purchased_at: receipt.purchased_at,
			tax: taxFromRate(subtotal, rate),
			tax_rate: rate,
			shipping: 0,
			allocate_extras: true,
			notes: 'Walmart Supercenter, Orlando (E Colonial Dr). Print-related lines only; notebooks/folders excluded. Full receipt: 20 items, $48.79 + $3.17 tax = $51.96.',
			lines
		});
		const r = db.prepare('SELECT subtotal, tax, total FROM receipts WHERE id = ?').get(receipt.id) as Receipt;
		console.log(
			`Walmart receipt #${receipt.id} updated: subtotal $${(r.subtotal / 1e6).toFixed(2)} tax $${(r.tax / 1e6).toFixed(2)} total $${(r.total / 1e6).toFixed(2)}`
		);
	}

	// ---- 2 & 3. Fishman job materials ----
	const jobIdFor = (inv: string) =>
		(db.prepare('SELECT id FROM jobs WHERE invoice_number = ?').get(inv) as { id: number } | undefined)?.id;
	const materials = (jobId: number, productId: number) =>
		db.prepare('SELECT * FROM job_materials WHERE job_id = ? AND product_id = ?').all(jobId, productId) as JobMaterial[];

	const job1 = jobIdFor('Fishman082426');
	const job2 = jobIdFor('Fishman082526');
	if (!job1 || !job2) throw new Error('Fishman jobs not found — run import-jobs-fishman-2026-08.ts first');

	for (const m of materials(job1, P.indexTabs)) {
		removeJobMaterial(m.id);
		addJobMaterial(job1, P.tabs8, m.qty_base, 'used', null);
		console.log(`job #${job1}: swapped ${m.qty_base} x "${product(P.indexTabs).name}" -> "${product(P.tabs8).name}"`);
	}

	for (const jobId of [job1, job2]) {
		for (const m of materials(jobId, P.vinyl)) {
			if (m.unit_cost_at_time > 0) continue;
			removeJobMaterial(m.id);
			addJobMaterial(jobId, P.vinyl, m.qty_base, 'used', null);
			console.log(`job #${jobId}: re-snapshotted ${m.qty_base} vinyl sheets at $${(product(P.vinyl).avg_cost / 1e6).toFixed(4)}/sheet`);
		}
	}
});

run();
