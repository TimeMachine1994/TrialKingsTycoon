<script lang="ts">
	import ProductForm from '$lib/components/ProductForm.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney, fmtUnitCost } from '$lib/money';

	let { data, form } = $props();

	let showForm = $state(false);
</script>

<svelte:head><title>Products · Print Kings Tycoon</title></svelte:head>

<div class="mb-4 flex items-center justify-between">
	<h2 class="text-sm" style="color: var(--paper);">PRODUCT CATALOG</h2>
	<button class="pixel-btn green" onclick={() => (showForm = !showForm)}>
		<Sprite name="box" size={24} />
		{showForm ? 'CLOSE' : 'NEW PRODUCT'}
	</button>
</div>

{#if form?.error}
	<div class="pixel-panel mb-4 p-3" style="background: var(--red); color: white;">{form.error}</div>
{/if}

{#if showForm}
	<div class="pixel-panel mb-6 p-4">
		<h3 class="mb-3 text-[11px]">ADD PRODUCT</h3>
		<ProductForm action="?/create" onsaved={() => (showForm = false)} />
	</div>
{/if}

<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
	{#each data.products as p (p.id)}
		<a href="/products/{p.id}" class="pixel-panel block p-4 hover:brightness-105">
			<div class="flex items-center gap-3">
				<Sprite name={p.sprite} size={48} />
				<div class="min-w-0">
					<div class="pixel-font truncate text-[10px]" style="color: var(--accent-dark);">
						{p.name}
					</div>
					<span class="pixel-badge mt-1" style="background: var(--paper-dark);">{p.category}</span>
				</div>
			</div>
			<div class="mt-3 grid grid-cols-2 gap-1 text-lg">
				<div>
					On hand:
					<span class="mono-num" style="color: {p.qty_on_hand < 0 ? 'var(--red)' : 'var(--ink)'};">
						{p.qty_on_hand.toLocaleString()} {p.base_unit}
					</span>
				</div>
				<div>Avg: <span class="mono-num">{fmtUnitCost(p.avg_cost)}/{p.base_unit}</span></div>
				<div class="col-span-2">
					Value: <span class="mono-num">{fmtMoney(p.qty_on_hand * p.avg_cost)}</span>
					{#if p.reorder_point !== null && p.qty_on_hand <= p.reorder_point}
						<span class="pixel-badge" style="background: var(--red); color: white;">LOW</span>
					{/if}
				</div>
			</div>
		</a>
	{/each}
</div>
