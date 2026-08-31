<script lang="ts">
	import { PALETTE, SPRITES } from '$lib/sprites';

	let { name, size = 32 }: { name: string; size?: number } = $props();

	const grid = $derived(SPRITES[name] ?? SPRITES.box);

	interface Px {
		x: number;
		y: number;
		fill: string;
	}

	const pixels = $derived.by(() => {
		const out: Px[] = [];
		grid.forEach((row, y) => {
			for (let x = 0; x < row.length; x++) {
				const ch = row[x];
				if (ch !== '.' && PALETTE[ch]) {
					out.push({ x, y, fill: PALETTE[ch] });
				}
			}
		});
		return out;
	});
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	shape-rendering="crispEdges"
	style="image-rendering: pixelated;"
	role="img"
	aria-label={name}
>
	{#each pixels as p (p.y * 16 + p.x)}
		<rect x={p.x} y={p.y} width="1" height="1" fill={p.fill} />
	{/each}
</svg>
