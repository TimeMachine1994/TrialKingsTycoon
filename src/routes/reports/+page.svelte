<script lang="ts">
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney, fmtUnitCost } from '$lib/money';

	let { data } = $props();

	const totalValue = $derived(data.valuation.reduce((a, v) => a + v.value, 0));
</script>

<svelte:head><title>Reports · Print Kings Tycoon</title></svelte:head>

<h2 class="mb-4 text-sm" style="color: var(--paper);">REPORTS — SALES VS COGS</h2>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	<section class="pixel-panel p-4 lg:col-span-2">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
			<Sprite name="coin" size={24} /> MONTHLY P&amp;L (MATERIALS)
		</h3>
		{#if data.periods.length === 0}
			<p>No jobs recorded yet.</p>
		{:else}
			<table class="pixel-table">
				<thead>
					<tr><th>Month</th><th>Sales</th><th>COGS (used)</th><th>Waste</th><th>Gross margin</th><th>Margin %</th></tr>
				</thead>
				<tbody>
					{#each data.periods as p (p.period)}
						{@const margin = p.sales - p.cogs - p.waste}
						<tr>
							<td class="mono-num">{p.period}</td>
							<td class="mono-num" style="color: var(--green);">{fmtMoney(p.sales)}</td>
							<td class="mono-num">{fmtMoney(p.cogs)}</td>
							<td class="mono-num" style="color: var(--red);">{fmtMoney(p.waste)}</td>
							<td class="mono-num" style="color: {margin >= 0 ? 'var(--green)' : 'var(--red)'};">{fmtMoney(margin)}</td>
							<td class="mono-num">{p.sales > 0 ? ((margin / p.sales) * 100).toFixed(1) + '%' : '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="pixel-panel p-4">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--red);">
			<Sprite name="trash" size={24} /> WASTE BY PRODUCT
		</h3>
		{#if data.waste.length === 0}
			<p>No waste recorded. Impressive!</p>
		{:else}
			<table class="pixel-table">
				<thead>
					<tr><th>Product</th><th>Qty wasted</th><th>Cost</th><th>Reasons</th></tr>
				</thead>
				<tbody>
					{#each data.waste as w (w.product_id)}
						<tr>
							<td><a href="/products/{w.product_id}" class="underline">{w.product_name}</a></td>
							<td class="mono-num">{w.qty.toLocaleString()} {w.base_unit}</td>
							<td class="mono-num" style="color: var(--red);">{fmtMoney(w.cost)}</td>
							<td class="text-sm">{w.reasons ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="pixel-panel p-4">
		<h3 class="mb-3 flex items-center gap-2 text-[11px]" style="color: var(--accent-dark);">
			<Sprite name="ream" size={24} /> INVENTORY VALUATION
		</h3>
		<table class="pixel-table">
			<thead>
				<tr><th>Product</th><th>On hand</th><th>Avg cost</th><th>Value</th></tr>
			</thead>
			<tbody>
				{#each data.valuation as v (v.id)}
					<tr>
						<td><a href="/products/{v.id}" class="underline">{v.name}</a></td>
						<td class="mono-num">{v.qty_on_hand.toLocaleString()} {v.base_unit}</td>
						<td class="mono-num">{fmtUnitCost(v.avg_cost)}</td>
						<td class="mono-num">{fmtMoney(v.value)}</td>
					</tr>
				{/each}
				<tr>
					<td class="pixel-font text-[10px]" colspan="3">TOTAL</td>
					<td class="mono-num" style="color: var(--green);">{fmtMoney(totalValue)}</td>
				</tr>
			</tbody>
		</table>
	</section>
</div>
