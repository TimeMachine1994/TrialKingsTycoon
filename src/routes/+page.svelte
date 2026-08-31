<script lang="ts">
	import StatTile from '$lib/components/StatTile.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney } from '$lib/money';

	let { data } = $props();

	const kindLabel: Record<string, string> = {
		receipt: 'RECEIVED',
		job_use: 'USED',
		job_waste: 'WASTE',
		adjustment: 'ADJUST'
	};
	const kindColor: Record<string, string> = {
		receipt: 'var(--green)',
		job_use: 'var(--accent)',
		job_waste: 'var(--red)',
		adjustment: 'var(--gold-dark)'
	};
</script>

<svelte:head><title>HQ · Print Kings Tycoon</title></svelte:head>

<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
	<StatTile label="Inventory Value" value={fmtMoney(data.stats.inventoryValue)} sprite="ream" />
	<StatTile label="Sales MTD" value={fmtMoney(data.stats.salesMtd)} sprite="coin" tone="good" />
	<StatTile label="COGS MTD" value={fmtMoney(data.stats.cogsMtd)} sprite="invoice" />
	<StatTile label="Waste MTD" value={fmtMoney(data.stats.wasteMtd)} sprite="trash" tone="bad" />
</div>

<div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
	<section class="pixel-panel p-4">
		<h2 class="mb-3 text-[11px]" style="color: var(--red);">⚠ LOW STOCK</h2>
		{#if data.lowStock.length === 0}
			<p>All stocked up. Nice work, boss.</p>
		{:else}
			<table class="pixel-table">
				<thead>
					<tr><th>Item</th><th>On hand</th><th>Reorder at</th><th></th></tr>
				</thead>
				<tbody>
					{#each data.lowStock as p (p.id)}
						<tr>
							<td class="flex items-center gap-2">
								<Sprite name={p.sprite} size={20} />
								<a href="/products/{p.id}" class="underline">{p.name}</a>
							</td>
							<td class="mono-num">{p.qty_on_hand.toLocaleString()} {p.base_unit}</td>
							<td class="mono-num">{p.reorder_point?.toLocaleString()}</td>
							<td><a href="/receipts" class="pixel-btn small green">BUY</a></td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="pixel-panel p-4">
		<h2 class="mb-3 text-[11px]" style="color: var(--accent-dark);">RECENT ACTIVITY</h2>
		{#if data.recent.length === 0}
			<p>No activity yet. Post a receipt to stock your shop!</p>
		{:else}
			<table class="pixel-table">
				<thead>
					<tr><th>What</th><th>Item</th><th>Qty</th><th>When</th></tr>
				</thead>
				<tbody>
					{#each data.recent as m (m.id)}
						<tr>
							<td>
								<span class="pixel-badge" style="background: {kindColor[m.kind]}; color: white;">
									{kindLabel[m.kind]}
								</span>
							</td>
							<td><a href="/products/{m.product_id}" class="underline">{m.product_name}</a></td>
							<td class="mono-num">{m.qty_delta > 0 ? '+' : ''}{m.qty_delta.toLocaleString()} {m.base_unit}</td>
							<td class="mono-num">{m.created_at.slice(0, 16)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>

<div class="mt-6 flex flex-wrap gap-3">
	<a href="/receipts" class="pixel-btn green"><Sprite name="receipt" size={24} /> POST A RECEIPT</a>
	<a href="/jobs" class="pixel-btn blue"><Sprite name="binder" size={24} /> START A JOB</a>
	<a href="/products" class="pixel-btn"><Sprite name="binderclip" size={24} /> ADD A PRODUCT</a>
</div>
