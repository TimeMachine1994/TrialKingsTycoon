<script lang="ts">
	import { enhance } from '$app/forms';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney, parseMoney } from '$lib/money';

	let { data, form } = $props();

	let showForm = $state(false);
	let showVendorForm = $state(false);

	interface LineDraft {
		product_id: number;
		unit_name: string;
		base_units_per: number;
		qty_purchased: number;
		line_cost: string;
	}

	let lines = $state<LineDraft[]>([]);
	let tax = $state('0');
	let shipping = $state('0');

	function addLine() {
		const first = data.products[0];
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
		const product = data.products.find((p) => p.id === productId);
		const base = { unit_name: product ? product.base_unit : 'each', base_units_per: 1 };
		const convs = data.conversions
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

	const subtotal = $derived(lines.reduce((a, l) => a + safeParse(l.line_cost), 0));
	const grandTotal = $derived(subtotal + safeParse(tax) + safeParse(shipping));

	const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head><title>Receipts · Print Kings Tycoon</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
	<h2 class="text-sm" style="color: var(--paper);">RECEIPTS (PURCHASES IN)</h2>
	<div class="flex gap-2">
		<button class="pixel-btn small" onclick={() => (showVendorForm = !showVendorForm)}>+ VENDOR</button>
		<button
			class="pixel-btn green"
			onclick={() => {
				showForm = !showForm;
				if (showForm && lines.length === 0) addLine();
			}}
		>
			<Sprite name="receipt" size={24} />
			{showForm ? 'CLOSE' : 'NEW RECEIPT'}
		</button>
	</div>
</div>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

{#if showVendorForm}
	<form method="POST" action="?/addVendor" class="pixel-panel mb-4 flex flex-wrap items-end gap-3 p-4" use:enhance={() => ({ update }) => { showVendorForm = false; update(); }}>
		<label>Vendor name <input name="name" class="pixel-input" required placeholder="Amazon" /></label>
		<label>Website <input name="url" class="pixel-input" placeholder="https://..." /></label>
		<button class="pixel-btn small green" type="submit">SAVE VENDOR</button>
	</form>
{/if}

{#if showForm}
	<form
		method="POST"
		action="?/post"
		class="pixel-panel mb-6 p-4"
		use:enhance={() =>
			({ result, update }) => {
				if (result.type === 'success') {
					showForm = false;
					lines = [];
					tax = '0';
					shipping = '0';
				}
				update();
			}}
	>
		<h3 class="mb-3 text-[11px]">NEW RECEIPT</h3>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-4">
			<label>
				Vendor*
				<select name="vendor_id" class="pixel-select" required>
					{#each data.vendors as v (v.id)}<option value={v.id}>{v.name}</option>{/each}
				</select>
			</label>
			<label>Date* <input name="purchased_at" type="date" class="pixel-input" value={today} required /></label>
			<label>Order / ref # <input name="ref_number" class="pixel-input" placeholder="112-1234567" /></label>
			<label>Notes <input name="notes" class="pixel-input" /></label>
		</div>

		<h4 class="pixel-font mt-4 mb-2 text-[10px]">LINES</h4>
		{#each lines as line, i (i)}
			<div class="mb-2 grid grid-cols-2 items-end gap-2 md:grid-cols-6">
				<label class="col-span-2">
					Product
					<select class="pixel-select" bind:value={line.product_id} onchange={() => onProductChange(line)}>
						{#each data.products as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
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
		<button type="button" class="pixel-btn small" onclick={addLine}>+ ADD LINE</button>

		<div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
			<label>Tax ($) <input name="tax" class="pixel-input" bind:value={tax} /></label>
			<label>Shipping ($) <input name="shipping" class="pixel-input" bind:value={shipping} /></label>
			<label class="flex items-end gap-2 pb-2">
				<input type="checkbox" name="allocate_extras" checked />
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

		<input type="hidden" name="lines" value={JSON.stringify(lines)} />
		<button class="pixel-btn green mt-3" type="submit">POST RECEIPT</button>
		<span class="ml-2 text-sm">Posting updates stock &amp; average costs — check the total matches your receipt!</span>
	</form>
{/if}

<div class="pixel-panel p-4">
	{#if data.receipts.length === 0}
		<p>No receipts yet. Post your first purchase!</p>
	{:else}
		<table class="pixel-table">
			<thead>
				<tr><th>Date</th><th>Vendor</th><th>Ref #</th><th>Lines</th><th>Total</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.receipts as r (r.id)}
					<tr>
						<td class="mono-num">{r.purchased_at}</td>
						<td>{r.vendor_name}</td>
						<td class="mono-num">{r.ref_number ?? '—'}</td>
						<td class="mono-num">{r.line_count}</td>
						<td class="mono-num">{fmtMoney(r.total)}</td>
						<td><a href="/receipts/{r.id}" class="pixel-btn small">VIEW</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
