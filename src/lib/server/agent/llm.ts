import { agentConfig } from './config';

export type ChatContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } };

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string | ChatContentPart[];
}

/** Hermes reasoning models may wrap chain-of-thought in <think> tags; drop it. */
export function stripThinking(text: string): string {
	return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Single non-streaming call to an OpenAI-compatible /chat/completions endpoint
 * (the Hermes gateway). Returns the assistant text with reasoning stripped.
 */
export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
	const cfg = agentConfig();
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		// Bypasses ngrok's free-tier HTML interstitial on non-browser requests.
		'ngrok-skip-browser-warning': 'true'
	};
	if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

	let res: Response;
	try {
		res = await fetch(`${cfg.baseUrl}/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ model: cfg.model, messages, stream: false }),
			signal: AbortSignal.timeout(cfg.timeoutMs)
		});
	} catch (e) {
		const reason = e instanceof Error && e.name === 'TimeoutError' ? 'timed out' : 'unreachable';
		throw new Error(`Agent gateway ${reason} (${cfg.baseUrl})`);
	}

	const bodyText = await res.text();
	if (!res.ok) {
		throw new Error(`Agent gateway returned ${res.status}: ${bodyText.slice(0, 200)}`);
	}

	let body: { choices?: Array<{ message?: { content?: unknown } }> };
	try {
		body = JSON.parse(bodyText);
	} catch {
		throw new Error(`Agent gateway returned non-JSON: ${bodyText.slice(0, 200)}`);
	}

	const content = body.choices?.[0]?.message?.content;
	if (typeof content === 'string') return stripThinking(content);
	if (Array.isArray(content)) {
		return stripThinking(
			content
				.map((p) => (p && typeof p === 'object' && 'text' in p ? String(p.text) : ''))
				.join('')
		);
	}
	throw new Error('Agent gateway returned an empty reply');
}
