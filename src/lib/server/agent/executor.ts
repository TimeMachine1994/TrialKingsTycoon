import { db, setSetting } from '$lib/server/db';
import { fmtMoney, parseMoney } from '$lib/money';
import { saveAttachmentBytes } from '$lib/server/services/attachments';
import { addJobMaterial, createJob, setJobStatus } from '$lib/server/services/jobs';
import { postReceipt } from '$lib/server/services/receipts';
import type { NewProductSpec, NewVendorSpec, ProductRef, VendorRef, WriteAction } from './actions';
import { toMaterial, toNewJob, toNewReceipt } from './mappers';
import { readUpload } from './uploads';

export interface ProposalResult {
	summary: string;
	receipt_id?: number;
	job_id?: number;
	product_id?: number;
	vendor_id?: number;
	created_products?: string[];
	created_vendors?: string[];
	attachment_saved?: boolean;
}

function insertVendor(spec: NewVendorSpec): number {
	return db
		.prepare('INSERT INTO vendors (name, url, notes) VALUES (?, ?, ?)')
		.run(spec.name, spec.url ?? null, spec.notes ?? null).lastInsertRowid as number;
}

function insertProduct(spec: NewProductSpec): number {
	const id = db
		.prepare(
			`INSERT INTO products (name, sku, category, base_unit, sprite, reorder_point, notes)
			 VALUES (?, ?, ?, ?, 'box', ?, ?)`
		)
		.run(
			spec.name,
			spec.sku ?? null,
			spec.category ?? 'other',
			spec.base_unit || 'each',
			spec.reorder_point ?? null,
			spec.notes ?? null
		).lastInsertRowid as number;
	if (spec.conv_name && spec.conv_per && spec.conv_per > 1) {
		db.prepare('INSERT INTO unit_conversions (product_id, unit_name, base_units_per) VALUES (?, ?, ?)').run(
			id,
			spec.conv_name,
			spec.conv_per
		);
	}
	return id;
}

function assertExists(table: 'products' | 'vendors' | 'jobs', id: number): void {
	const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
	if (!row) throw new Error(`${table.slice(0, -1)} #${id} does not exist`);
}

/**
 * Executes a confirmed write action. Everything runs in one transaction so a
 * failure anywhere (including inside postReceipt / addJobMaterial, which use
 * savepoints when nested) rolls back newly created vendors/products too.
 * The receipt image, if any, is attached after the transaction commits.
 */
export function executeProposal(action: WriteAction, imageName: string | null): ProposalResult {
	const createdProducts: string[] = [];
	const createdVendors: string[] = [];
	const productCache = new Map<string, number>();

	const resolveVendor = (ref: VendorRef): number => {
		if ('id' in ref) {
			assertExists('vendors', ref.id);
			return ref.id;
		}
		createdVendors.push(ref.new.name);
		return insertVendor(ref.new);
	};

	const resolveProduct = (ref: ProductRef): number => {
		if ('id' in ref) {
			assertExists('products', ref.id);
			return ref.id;
		}
		// The same NEW product may appear on several lines; create it once.
		const key = ref.new.name.toLowerCase();
		const cached = productCache.get(key);
		if (cached) return cached;
		const id = insertProduct(ref.new);
		productCache.set(key, id);
		createdProducts.push(ref.new.name);
		return id;
	};

	const run = db.transaction((): ProposalResult => {
		switch (action.type) {
			case 'post_receipt': {
				const vendorId = resolveVendor(action.vendor);
				const { receipt, taxRateStr } = toNewReceipt(action, vendorId, resolveProduct);
				const receiptId = postReceipt(receipt);
				if (taxRateStr) setSetting('default_tax_rate', taxRateStr);
				const total = receipt.lines.reduce((s, l) => s + l.line_cost, 0) + receipt.tax + receipt.shipping;
				return { summary: `Posted receipt #${receiptId} (${fmtMoney(total)})`, receipt_id: receiptId, vendor_id: vendorId };
			}
			case 'create_job': {
				const jobId = createJob(toNewJob(action));
				for (const m of action.materials ?? []) {
					const mm = toMaterial(m, resolveProduct);
					addJobMaterial(jobId, mm.product_id, mm.qty_base, mm.kind, mm.waste_reason);
				}
				return { summary: `Created job #${jobId} "${action.name}"`, job_id: jobId };
			}
			case 'add_job_materials': {
				assertExists('jobs', action.job_id);
				for (const m of action.materials) {
					const mm = toMaterial(m, resolveProduct);
					addJobMaterial(action.job_id, mm.product_id, mm.qty_base, mm.kind, mm.waste_reason);
				}
				return { summary: `Added ${action.materials.length} material line(s) to job #${action.job_id}`, job_id: action.job_id };
			}
			case 'update_job': {
				assertExists('jobs', action.job_id);
				const sets: string[] = [];
				const params: unknown[] = [];
				if (action.client !== undefined) {
					sets.push('client = ?');
					params.push(action.client);
				}
				if (action.invoice_number !== undefined) {
					sets.push('invoice_number = ?');
					params.push(action.invoice_number);
				}
				if (action.invoiced_amount !== undefined) {
					sets.push('invoiced_amount = ?');
					params.push(parseMoney(action.invoiced_amount));
				}
				if (sets.length) db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params, action.job_id);
				if (action.status) setJobStatus(action.job_id, action.status);
				return { summary: `Updated job #${action.job_id}`, job_id: action.job_id };
			}
			case 'create_product': {
				const { type: _t, ...spec } = action;
				const id = insertProduct(spec);
				return { summary: `Created product #${id} "${spec.name}"`, product_id: id };
			}
			case 'create_vendor': {
				const { type: _t, ...spec } = action;
				const id = insertVendor(spec);
				return { summary: `Created vendor #${id} "${spec.name}"`, vendor_id: id };
			}
		}
	});

	const result = run();
	if (createdProducts.length) result.created_products = createdProducts;
	if (createdVendors.length) result.created_vendors = createdVendors;

	if (result.receipt_id && imageName) {
		const file = readUpload(imageName);
		if (file) {
			saveAttachmentBytes(result.receipt_id, { name: `receipt-${result.receipt_id}${imageName.slice(imageName.lastIndexOf('.'))}`, mime: file.mime, bytes: file.bytes });
			result.attachment_saved = true;
		}
	}
	return result;
}
