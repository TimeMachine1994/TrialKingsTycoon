<script lang="ts">
	import { enhance } from '$app/forms';
	import Sprite from '$lib/components/Sprite.svelte';
	import { fmtMoney, fmtUnitCost } from '$lib/money';
	import { SPRITE_NAMES } from '$lib/sprites';

	let { data, form } = $props();

	let showForm = $state(false);
	let chosenSprite = $state('box');

	const categories = ['paper', 'toner', 'binding', 'other'];
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
	<form
		method="POST"
		action="?/create"
		class="pixel-panel mb-6 p-4"
		use:enhance={() =>
			({ update }) => {
				showForm = false;
				update();
			}}
	>
		<h3 class="mb-3 text-[11px]">ADD PRODUCT</h3>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
			<label>
				Name*
				<input name="name" class="pixel-input" required placeholder="Letter Paper 24lb" />
			</label>
			<label>
				Category
				<select name="category" class="pixel-select">
					{#each categories as c (c)}<option value={c}>{c}</option>{/each}
				</select>
			</label>
			<label>
				Base unit (what you consume)
				<input name="base_unit" class="pixel-input" placeholder="sheet" />
			</label>
			<label>
				SKU / model #
				<input name="sku" class="pixel-input" />
			</label>
			<label>
				Reorder point (base units)
				<input name="reorder_point" class="pixel-input" type="number" min="0" step="1" />
			</label>
			<label>
				Notes
				<input name="notes" class="pixel-input" />
			</label>
			<label>
				Purchase unit name (optional)
				<input name="conv_name" class="pixel-input" placeholder="ream (500)" />
			</label>
			<label>
				Base units per purchase unit
				<input name="conv_per" class="pixel-input" type="number" min="2" step="1" placeholder="500" />
			</label>
			<div>
				<span>Icon</span>
				<input type="hidden" name="sprite" value={chosenSprite} />
				<div class="mt-1 flex flex-wrap gap-1">
					{#each SPRITE_NAMES as s (s)}
						<button
							type="button"
							class="border-4 p-1"
							style="border-color: {chosenSprite === s ? 'var(--accent)' : 'transparent'}; background: var(--paper);"
							onclick={() => (chosenSprite = s)}
							title={s}
						>
							<Sprite name={s} size={24} />
						</button>
					{/each}
				</div>
			</div>
		</div>
		<button class="pixel-btn green mt-4" type="submit">SAVE PRODUCT</button>
	</form>
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
