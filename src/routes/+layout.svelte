<script lang="ts">
	import '../app.css';
	import AgentDrawer from '$lib/components/agent/AgentDrawer.svelte';
	import Sprite from '$lib/components/Sprite.svelte';
	import { page } from '$app/state';

	let { data, children } = $props();

	let agentOpen = $state(false);

	const nav = [
		{ href: '/', label: 'HQ', sprite: 'store' },
		{ href: '/products', label: 'Products', sprite: 'binderclip' },
		{ href: '/receipts', label: 'Receipts', sprite: 'receipt' },
		{ href: '/jobs', label: 'Jobs', sprite: 'binder' },
		{ href: '/vendors', label: 'Vendors', sprite: 'truck' },
		{ href: '/reports', label: 'Reports', sprite: 'coin' },
		{ href: '/planner', label: 'Planner', sprite: 'chart' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="mx-auto max-w-6xl px-4 py-6">
	<header class="mb-6">
		<div class="pixel-panel flex flex-wrap items-center gap-4 p-4">
			<Sprite name="store" size={48} />
			<h1 class="text-sm md:text-base" style="color: var(--accent-dark);">
				PRINT KINGS TYCOON
			</h1>
			<span class="pixel-badge" style="background: var(--gold);">INVENTORY HQ</span>
			<span class="flex-1"></span>
			<button
				type="button"
				class="pixel-btn {agentOpen ? 'blue' : ''}"
				disabled={!data.agentEnabled}
				title={data.agentEnabled ? 'Open the HQ Assistant' : 'Set AGENT_BASE_URL in .env to enable the assistant'}
				onclick={() => (agentOpen = !agentOpen)}
			>
				<Sprite name="invoice" size={24} />
				ASSISTANT
			</button>
		</div>
		<nav class="mt-4 flex flex-wrap gap-2">
			{#each nav as item (item.href)}
				<a
					href={item.href}
					class="pixel-btn {isActive(item.href) ? 'blue' : ''}"
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					<Sprite name={item.sprite} size={24} />
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	<main>
		{@render children()}
	</main>

	<footer class="mt-10 pb-6 text-center">
		<span class="pixel-font text-[9px]" style="color: var(--paper-dark);">
			PENNY-BY-PENNY COGS TRACKING &middot; LOCAL SQLITE
		</span>
	</footer>
</div>

{#if data.agentEnabled}
	<AgentDrawer bind:open={agentOpen} />
{/if}
