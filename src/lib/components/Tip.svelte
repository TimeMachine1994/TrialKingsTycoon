<script lang="ts">
	let { text, warn = false }: { text: string; warn?: boolean } = $props();
</script>

<span class="pixel-tip-wrap">
	<button type="button" class="pixel-tip {warn ? 'warn' : ''}" aria-label="Info">?</button>
	<span class="pixel-tip-bubble" role="tooltip">{text}</span>
</span>
