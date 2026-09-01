<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Product, Receipt, ReceiptLine, UnitConversion, Vendor } from '$lib/server/db';
	import { fmtMoney, fmtRate, parseMoney, parseRate, taxFromRate } from '$lib/money';

	export interface LineDraft {
		product_id: number;
		unit_name: string;
		base_units_per: number;
		qty_purchased: number;
		line_cost: string;
	}

	let {
		action,
		vendors,
		products,
		conversions,
		defaultTaxRate = '',
		receipt = null,
		existingLines = [],
		submitLabel = 'POST RECEIPT',
		allowFiles = true,
		onsaved,
		onNewProduct,
		newProductId = 0
	}: {
		action: string;
		vendors: Vendor[];
		products: Product[];
		conversions: UnitConversion[];
		defaultTaxRate?: string;
		receipt?: Receipt | null;
		existingLines?: ReceiptLine[];
		submitLabel?: string;
		allowFiles?: boolean;
		onsaved?: () => void;
		onNewProduct?: () => void;
		newProductId?: number;
	} = $props();

	// svelte-ignore state_referenced_locally -- edit vs. create is fixed for the component's lifetime
	const editing = receipt !== null;

	// Existing lines store cost with tax/shipping already folded in; back it out
	// for the edit form so the user sees what they actually typed on the receipt.
	function unallocatedCost(l: ReceiptLine, r: Receipt): string {
		const extras = r.tax + r.shipping;
		const cost =
			r.allocate_extras && extras > 0 && r.subtotal > 0
				? Math.round((l.line_cost * r.subtotal) / (r.subtotal + extras))
				: l.line_cost;
		return (cost / 1_000_000).toFixed(2);
	}

	// svelte-ignore state_referenced_locally -- seeded once from props
	let lines = $state<LineDraft[]>(
		receipt
			? existingLines.map((l) => ({
					product_id: l.product_id,
					unit_name: l.unit_name,
					base_units_per: l.base_units_per,
					qty_purchased: l.qty_purchased,
					line_cost: unallocatedCost(l, receipt)
				}))
			: []
	);
	// svelte-ignore state_referenced_locally
	let tax = $state(receipt ? (receipt.tax / 1_000_000).toFixed(2) : '0');
	// svelte-ignore state_referenced_locally
	let shipping = $state(receipt ? (receipt.shipping / 1_000_000).toFixed(2) : '0');
	// svelte-ignore state_referenced_locally
	let taxMode = $state<'rate' | 'manual'>(
		receipt ? (receipt.tax_rate !== null ? 'rate' : 'manual') : defaultTaxRate ? 'rate' : 'manual'
	);
	// svelte-ignore state_referenced_locally
	let taxRate = $state(receipt?.tax_rate != null ? fmtRate(receipt.tax_rate) : defaultTaxRate);
	// svelte-ignore state_referenced_locally
	let allocateExtras = $state(receipt ? receipt.allocate_extras === 1 : true);

	// Auto-select a product created inline on the last draft line
	let handledNewProductId = $state(0);
	$effect(() => {
		if (newProductId && newProductId !== handledNewProductId) {
			handledNewProductId = newProductId;
			if (lines.length > 0) {
				const last = lines[lines.length - 1];
				last.product_id = newProductId;
				onProductChange(last);
			}
		}
	});

	export function addLine() {
		const first = products[0];
		lines.push({
			product_id: first?.id ?? 0,
			unit_name: first ? first.base_unit : 'each',
			base_units_per: 1,
			qty_purchased: 1,
			line_cost: ''
		});
	}

	function removeLine(i: number) {
		lines.splice(i, 1);
	}

	function unitOptions(productId: number) {
		const product = products.find((p) => p.id === productId);
		const base = { unit_name: product ? product.base_unit : 'each', base_units_per: 1 };
		const convs = conversions
			.filter((c) => c.product_id === productId)
			.map((c) => ({ unit_name: c.unit_name, base_units_per: c.base_units_per }));
		return [base, ...convs];
	}

	function onProductChange(line: LineDraft) {
		const opts = unitOptions(line.product_id);
		line.unit_name = opts[0].unit_name;
		line.base_units_per = opts[0].base_units_per;
	}

	function onUnitChange(line: LineDraft) {
		const opt = unitOptions(line.product_id).find((o) => o.unit_name === line.unit_name);
		if (opt) line.base_units_per = opt.base_units_per;
	}

	function safeParse(v: string): number {
		try {
			return parseMoney(v || '0');
		} catch {
			return 0;
		}
	}

	function safeParseRate(v: string): number {
		try {
			return parseRate(v || '0');
		} catch {
			return 0;
		}
	}

	const subtotal = $derived(lines.reduce((a, l) => a + safeParse(l.line_cost), 0));
	const taxMicro = $derived(
		taxMode === 'rate' ? taxFromRate(subtotal, safeParseRate(taxRate)) : safeParse(tax)
	);
	const grandTotal = $derived(subtotal + taxMicro + safeParse(shipping));

	const today = new Date().toISOString().slice(0, 10);
</script>

<form
	method="POST"
	{action}
	enctype="multipart/form-data"
	use:enhance={() =>
		({ result, update }) => {
			if (result.type === 'success') {
				onsaved?.();
				if (!editing) {
					lines = [];
					tax = '0';
					shipping = '0';
				}
			}
			update();
		}}
>
	<div class="grid grid-cols-1 gap-3 md:grid-cols-4">
		<label>
			Vendor*
			<select name="vendor_id" class="pixel-select" required value={receipt?.vendor_id}>
				{#each vendors as v (v.id)}<option value={v.id}>{v.name}</option>{/each}
			</select>
		</label>
		<label>Date* <input name="purchased_at" type="date" class="pixel-input" value={receipt?.purchased_at ?? today} required /></label>
		<label>Order / ref # <input name="ref_number" class="pixel-input" placeholder="112-1234567" value={receipt?.ref_number ?? ''} /></label>
		<label>Notes <input name="notes" class="pixel-input" value={receipt?.notes ?? ''} /></label>
	</div>

	<h4 class="pixel-font mt-4 mb-2 text-[10px]">LINES</h4>
	{#each lines as line, i (i)}
		<div class="mb-2 grid grid-cols-2 items-end gap-2 md:grid-cols-6">
			<label class="col-span-2">
				Product
				<select class="pixel-select" bind:value={line.product_id} onchange={() => onProductChange(line)}>
					{#each products as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
				</select>
			</label>
			<label>
				Unit
				<select class="pixel-select" bind:value={line.unit_name} onchange={() => onUnitChange(line)}>
					{#each unitOptions(line.product_id) as o (o.unit_name)}
						<option value={o.unit_name}>{o.unit_name}</option>
					{/each}
				</select>
			</label>
			<label>Qty <input type="number" min="1" step="1" class="pixel-input" bind:value={line.qty_purchased} /></label>
			<label>Line cost ($) <input class="pixel-input" placeholder="18.00" bind:value={line.line_cost} /></label>
			<div class="flex items-center gap-2">
				<span class="mono-num text-sm">
					= {(line.qty_purchased * line.base_units_per).toLocaleString()} base units
				</span>
				<button type="button" class="pixel-btn small red" onclick={() => removeLine(i)}>X</button>
			</div>
		</div>
	{/each}
	<div class="flex gap-2">
		<button type="button" class="pixel-btn small" onclick={addLine}>+ ADD LINE</button>
		{#if onNewProduct}
			<button type="button" class="pixel-btn small blue" onclick={onNewProduct}>+ NEW PRODUCT</button>
		{/if}
	</div>

	<div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
		<input type="hidden" name="tax_mode" value={taxMode} />
		<label>
			Tax rate (%)
			<input
				name="tax_rate"
				class="pixel-input"
				placeholder="7.25"
				bind:value={taxRate}
				disabled={taxMode === 'manual'}
				style={taxMode === 'manual' ? 'opacity: 0.45;' : ''}
				oninput={() => (taxMode = 'rate')}
			/>
		</label>
		<label>
			Tax ($){taxMode === 'rate' ? ' — auto' : ' — manual'}
			{#if taxMode === 'rate'}
				<span class="flex items-center gap-1">
					<input class="pixel-input mono-num" value={fmtMoney(taxMicro)} readonly style="background: var(--paper-dark);" />
					<button type="button" class="pixel-btn small" title="Enter exact tax from receipt" onclick={() => { tax = (taxMicro / 1_000_000).toFixed(2); taxMode = 'manual'; }}>✎</button>
				</span>
			{:else}
				<span class="flex items-center gap-1">
					<input name="tax" class="pixel-input" bind:value={tax} />
					<button type="button" class="pixel-btn small" title="Recalculate from rate" onclick={() => (taxMode = 'rate')}>↻</button>
				</span>
			{/if}
		</label>
		<label>Shipping ($) <input name="shipping" class="pixel-input" bind:value={shipping} /></label>
		<label class="flex items-end gap-2 pb-2">
			<input type="checkbox" name="allocate_extras" bind:checked={allocateExtras} />
			Fold tax+shipping into item costs
		</label>
		<div class="pb-1">
			<div class="pixel-font text-[9px]">SUBTOTAL</div>
			<div class="mono-num text-xl">{fmtMoney(subtotal)}</div>
		</div>
		<div class="pb-1">
			<div class="pixel-font text-[9px]">GRAND TOTAL</div>
			<div class="mono-num text-xl" style="color: var(--green);">{fmtMoney(grandTotal)}</div>
		</div>
	</div>

	{#if allowFiles}
		<label class="mt-3 block">
			Attach receipt files (images / PDF)
			<input
				type="file"
				name="files"
				multiple
				accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
				class="pixel-input"
			/>
		</label>
	{/if}

	<input type="hidden" name="lines" value={JSON.stringify(lines)} />
	<button class="pixel-btn green mt-3" type="submit">{submitLabel}</button>
	<span class="ml-2 text-sm">
		{editing
			? 'Saving re-applies stock & average costs from the new lines.'
			: 'Posting updates stock & average costs — check the total matches your receipt!'}
	</span>
</form>
