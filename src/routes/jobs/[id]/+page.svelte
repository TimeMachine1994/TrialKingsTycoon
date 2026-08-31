<script lang="ts">
	import { enhance } from '$app/forms';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney, fmtUnitCost } from '$lib/money';

	let { data, form } = $props();

	let materialKind = $state<'used' | 'waste'>('used');
	let selectedProduct = $state(0);
	let selectedUnit = $state('');

	function unitOptions(productId: number) {
		const product = data.products.find((p) => p.id === productId);
		const base = { unit_name: product ? product.base_unit : 'each', base_units_per: 1 };
		const convs = data.conversions
			.filter((c) => c.product_id === productId)
			.map((c) => ({ unit_name: c.unit_name, base_units_per: c.base_units_per }));
		return [base, ...convs];
	}

	const currentOptions = $derived(unitOptions(selectedProduct || (data.products[0]?.id ?? 0)));
	const currentPer = $derived(
		currentOptions.find((o) => o.unit_name === selectedUnit)?.base_units_per ?? 1
	);
</script>

<svelte:head><title>{data.job.name} · Print Kings Tycoon</title></svelte:head>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

<div class="pixel-panel mb-6 p-4">
	<div class="flex flex-wrap items-center gap-4">
		<Sprite name="binder" size={48} />
		<div class="min-w-0 flex-1">
			<h2 class="text-[13px]" style="color: var(--accent-dark);">{data.job.name}</h2>
			<div class="mt-1 flex flex-wrap gap-2">
				<span class="pixel-badge" style="background: var(--paper-dark);">{data.job.job_date}</span>
				{#if data.job.client}<span class="pixel-badge">CLIENT: {data.job.client}</span>{/if}
				{#if data.job.invoice_number}<span class="pixel-badge">INV: {data.job.invoice_number}</span>{/if}
				<span class="pixel-badge" style="background: {data.job.status === 'open' ? 'var(--gold)' : 'var(--green)'};">
					{data.job.status.toUpperCase()}
				</span>
			</div>
		</div>
		<form method="POST" action="?/toggleStatus" use:enhance>
			<button class="pixel-btn small" type="submit">
				{data.job.status === 'open' ? 'CLOSE JOB' : 'REOPEN'}
			</button>
		</form>
		<a href="/jobs" class="pixel-btn small">← BACK</a>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
		<div>
			<div class="pixel-font text-[9px]">REVENUE</div>
			<div class="mono-num text-2xl" style="color: var(--green);">{fmtMoney(data.job.invoiced_amount)}</div>
		</div>
		<div>
			<div class="pixel-font text-[9px]">MATERIALS</div>
			<div class="mono-num text-2xl">{fmtMoney(data.costs.usedCost)}</div>
		</div>
		<div>
			<div class="pixel-font text-[9px]">WASTE</div>
			<div class="mono-num text-2xl" style="color: var(--red);">{fmtMoney(data.costs.wasteCost)}</div>
		</div>
		<div>
			<div class="pixel-font text-[9px]">PROFIT</div>
			<div class="mono-num text-2xl" style="color: {data.costs.profit >= 0 ? 'var(--green)' : 'var(--red)'};">
				{fmtMoney(data.costs.profit)}
			</div>
		</div>
	</div>

	<form method="POST" action="?/updateJob" class="mt-4 grid grid-cols-2 items-end gap-3 border-t-4 border-dashed pt-4 md:grid-cols-4" use:enhance>
		<label>Invoiced ($) <input name="invoiced_amount" class="pixel-input" value={(data.job.invoiced_amount / 1_000_000).toFixed(2)} /></label>
		<label>Client <input name="client" class="pixel-input" value={data.job.client ?? ''} /></label>
		<label>Invoice # <input name="invoice_number" class="pixel-input" value={data.job.invoice_number ?? ''} /></label>
		<div><button class="pixel-btn small" type="submit">UPDATE</button></div>
	</form>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	<section class="pixel-panel p-4">
		<h3 class="mb-3 text-[11px]" style="color: var(--accent-dark);">ADD MATERIAL / WASTE</h3>
		<form method="POST" action="?/addMaterial" class="grid grid-cols-1 gap-3" use:enhance>
			<div class="flex gap-2">
				<button
					type="button"
					class="pixel-btn small {materialKind === 'used' ? 'blue' : ''}"
					onclick={() => (materialKind = 'used')}
				>
					<Sprite name="ream" size={18} /> USED
				</button>
				<button
					type="button"
					class="pixel-btn small {materialKind === 'waste' ? 'red' : ''}"
					onclick={() => (materialKind = 'waste')}
				>
					<Sprite name="trash" size={18} /> WASTE
				</button>
				<input type="hidden" name="kind" value={materialKind} />
			</div>
			<label>
				Product
				<select
					name="product_id"
					class="pixel-select"
					bind:value={selectedProduct}
					onchange={() => (selectedUnit = '')}
				>
					{#each data.products as p (p.id)}
						<option value={p.id}>{p.name} — {p.qty_on_hand.toLocaleString()} {p.base_unit} @ {fmtUnitCost(p.avg_cost)}</option>
					{/each}
				</select>
			</label>
			<div class="grid grid-cols-2 gap-3">
				<label>
					Unit
					<select name="unit_pick" class="pixel-select" bind:value={selectedUnit}>
						{#each currentOptions as o (o.unit_name)}
							<option value={o.unit_name}>{o.unit_name}</option>
						{/each}
					</select>
					<input type="hidden" name="base_units_per" value={currentPer} />
				</label>
				<label>Qty <input name="qty" type="number" min="1" step="1" class="pixel-input" value="1" /></label>
			</div>
			{#if materialKind === 'waste'}
				<label>Waste reason <input name="waste_reason" class="pixel-input" placeholder="misprint, jam, trim..." /></label>
			{/if}
			<button class="pixel-btn green" type="submit">ADD TO JOB</button>
		</form>
	</section>

	<section class="pixel-panel p-4">
		<h3 class="mb-3 text-[11px]" style="color: var(--accent-dark);">JOB MATERIALS</h3>
		{#if data.materials.length === 0}
			<p>Nothing consumed yet.</p>
		{:else}
			<table class="pixel-table">
				<thead>
					<tr><th>Item</th><th>Kind</th><th>Qty</th><th>@ Cost</th><th>Total</th><th></th></tr>
				</thead>
				<tbody>
					{#each data.materials as m (m.id)}
						<tr>
							<td class="flex items-center gap-2">
								<Sprite name={m.sprite} size={20} />
								{m.product_name}
								{#if m.waste_reason}<span class="text-sm">({m.waste_reason})</span>{/if}
							</td>
							<td>
								<span class="pixel-badge" style="background: {m.kind === 'waste' ? 'var(--red)' : 'var(--accent)'}; color: white;">
									{m.kind.toUpperCase()}
								</span>
							</td>
							<td class="mono-num">{m.qty_base.toLocaleString()} {m.base_unit}</td>
							<td class="mono-num">{fmtUnitCost(m.unit_cost_at_time)}</td>
							<td class="mono-num">{fmtMoney(m.qty_base * m.unit_cost_at_time)}</td>
							<td>
								<form method="POST" action="?/removeMaterial" use:enhance>
									<input type="hidden" name="material_id" value={m.id} />
									<button class="pixel-btn small red" type="submit" title="Remove (restocks)">X</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>
