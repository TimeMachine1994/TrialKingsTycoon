import { env } from '$env/dynamic/private';

export interface AgentConfig {
	baseUrl: string;
	apiKey: string;
	model: string;
	timeoutMs: number;
}

export function isAgentConfigured(): boolean {
	return Boolean(env.AGENT_BASE_URL?.trim());
}

export function agentConfig(): AgentConfig {
	const baseUrl = env.AGENT_BASE_URL?.trim().replace(/\/+$/, '');
	if (!baseUrl) throw new Error('AGENT_BASE_URL is not set');
	return {
		baseUrl,
		apiKey: env.AGENT_API_KEY?.trim() ?? '',
		model: env.AGENT_MODEL?.trim() || 'hermes-agent',
		timeoutMs: Number(env.AGENT_TIMEOUT_MS) || 120_000
	};
}
