<script lang="ts">
	import { enhance } from '$app/forms';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney, fmtUnitCost } from '$lib/money';

	let { data, form } = $props();

	let editing = $state(false);

	const kindLabel: Record<string, string> = {
		receipt: 'RECEIVED',
		job_use: 'USED',
		job_waste: 'WASTE',
		adjustment: 'ADJUST'
	};
</script>

<svelte:head><title>{data.product.name} · Print Kings Tycoon</title></svelte:head>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

<div class="pixel-panel mb-6 p-4">
	<div class="flex flex-wrap items-center gap-4">
		<Sprite name={data.product.sprite} size={64} />
		<div class="min-w-0 flex-1">
			<h2 class="text-[13px]" style="color: var(--accent-dark);">{data.product.name}</h2>
			<div class="mt-1 flex flex-wrap gap-2">
				<span class="pixel-badge" style="background: var(--paper-dark);">{data.product.category}</span>
				{#if data.product.sku}<span class="pixel-badge">SKU: {data.product.sku}</span>{/if}
				{#if data.product.qty_on_hand < 0}
					<span class="pixel-badge" style="background: var(--red); color: white;">NEGATIVE STOCK — CHECK ENTRIES</span>
				{/if}
			</div>
		</div>
		<button class="pixel-btn small" onclick={() => (editing = !editing)}>
			{editing ? 'CANCEL' : 'EDIT'}
		</button>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
		<div>
			<div class="pixel-font text-[9px]">ON HAND</div>
			<div class="mono-num text-2xl">{data.product.qty_on_hand.toLocaleString()} {data.product.base_unit}</div>
		</div>
		<div>
			<div class="pixel-font text-[9px]">AVG COST</div>
			<div class="mono-num text-2xl">{fmtUnitCost(data.product.avg_cost)}/{data.product.base_unit}</div>
		</div>
		<div>
			<div class="pixel-font text-[9px]">STOCK VALUE</div>
			<div class="mono-num text-2xl">{fmtMoney(data.product.qty_on_hand * data.product.avg_cost)}</div>
		</div>
		<div>
			<div class="pixel-font text-[9px]">UNITS</div>
			<div class="text-lg">
				{data.product.base_unit} ×1
				{#each data.conversions as c (c.id)}
					<br />{c.unit_name} ×{c.base_units_per.toLocaleString()}
				{/each}
			</div>
		</div>
	</div>

	{#if editing}
		<form method="POST" action="?/update" class="mt-4 grid grid-cols-1 gap-3 border-t-4 border-dashed pt-4 md:grid-cols-3" use:enhance>
			<label>Name <input name="name" class="pixel-input" value={data.product.name} /></label>
			<label>Reorder point <input name="reorder_point" type="number" min="0" step="1" class="pixel-input" value={data.product.reorder_point ?? ''} /></label>
			<label>Notes <input name="notes" class="pixel-input" value={data.product.notes ?? ''} /></label>
			<div><button class="pixel-btn green small" type="submit">SAVE</button></div>
		</form>
		<form method="POST" action="?/adjust" class="mt-3 flex flex-wrap items-end gap-3" use:enhance>
			<label>
				Correct count to (physical count)
				<input name="new_qty" type="number" step="1" class="pixel-input" value={data.product.qty_on_hand} />
			</label>
			<label>Reason <input name="note" class="pixel-input" placeholder="shelf count" /></label>
			<button class="pixel-btn small" type="submit">ADJUST STOCK</button>
		</form>
	{/if}
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	<section class="pixel-panel p-4">
		<h3 class="mb-3 text-[11px]" style="color: var(--accent-dark);">PURCHASE HISTORY — WHAT COST WHERE</h3>
		{#if data.purchases.length === 0}
			<p>No purchases yet. Post a receipt with this item.</p>
		{:else}
			<table class="pixel-table">
				<thead>
					<tr><th>Date</th><th>Vendor</th><th>Qty</th><th>Paid</th><th>Per {data.product.base_unit}</th><th>Receipt</th></tr>
				</thead>
				<tbody>
					{#each data.purchases as row (row.receipt_id + '-' + row.purchased_at + '-' + row.unit_cost_base)}
						<tr style={row.voided_at ? 'opacity: 0.55; text-decoration: line-through;' : ''}>
							<td class="mono-num">{row.purchased_at}</td>
							<td>
								{row.vendor_name}{#if row.ref_number}&nbsp;<span class="text-sm">#{row.ref_number}</span>{/if}
								{#if row.voided_at}
									<span class="pixel-badge" style="background: var(--red); color: white; text-decoration: none;">VOID</span>
								{/if}
							</td>
							<td class="mono-num">{row.qty_purchased.toLocaleString()} × {row.unit_name} ({row.qty_base.toLocaleString()})</td>
							<td class="mono-num">{fmtMoney(row.line_cost)}</td>
							<td class="mono-num">{fmtUnitCost(row.unit_cost_base)}</td>
							<td><a href="/receipts/{row.receipt_id}" class="pixel-btn small">VIEW</a></td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="pixel-panel p-4">
		<h3 class="mb-3 text-[11px]" style="color: var(--accent-dark);">MOVEMENT LEDGER</h3>
		{#if data.movements.length === 0}
			<p>No movements yet.</p>
		{:else}
			<table class="pixel-table">
				<thead>
					<tr><th>When</th><th>Kind</th><th>Qty</th><th>@ Cost</th></tr>
				</thead>
				<tbody>
					{#each data.movements as m (m.id)}
						<tr>
							<td class="mono-num">{m.created_at.slice(0, 16)}</td>
							<td><span class="pixel-badge" style="background: var(--paper-dark);">{kindLabel[m.kind]}</span></td>
							<td class="mono-num" style="color: {m.qty_delta < 0 ? 'var(--red)' : 'var(--green)'};">
								{m.qty_delta > 0 ? '+' : ''}{m.qty_delta.toLocaleString()}
							</td>
							<td class="mono-num">{fmtUnitCost(m.unit_cost)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>
