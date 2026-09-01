<script lang="ts">
	import { enhance } from '$app/forms';
	import Sprite from './Sprite.svelte';
	import { SPRITE_NAMES } from '$lib/sprites';

	let {
		action,
		onsaved
	}: { action: string; onsaved?: () => void } = $props();

	let chosenSprite = $state('box');

	const categories = ['paper', 'toner', 'binding', 'other'];
</script>

<form
	method="POST"
	{action}
	use:enhance={() =>
		({ result, update }) => {
			if (result.type === 'success') onsaved?.();
			update({ reset: result.type === 'success' });
		}}
>
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
