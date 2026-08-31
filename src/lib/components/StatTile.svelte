<script lang="ts">
	import Sprite from './Sprite.svelte';

	let {
		label,
		value,
		sprite,
		tone = 'default'
	}: { label: string; value: string; sprite: string; tone?: 'default' | 'good' | 'bad' } = $props();
</script>

<div class="pixel-panel flex items-center gap-4 p-4">
	<Sprite name={sprite} size={48} />
	<div>
		<div class="pixel-font text-[10px] uppercase" style="color: var(--accent-dark);">{label}</div>
		<div
			class="mono-num text-3xl"
			style="color: {tone === 'good' ? 'var(--green)' : tone === 'bad' ? 'var(--red)' : 'var(--ink)'};"
		>
			{value}
		</div>
	</div>
</div>
