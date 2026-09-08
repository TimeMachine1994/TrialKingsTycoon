import { isAgentConfigured } from '$lib/server/agent/config';
import { runTurn } from '$lib/server/agent/loop';
import { agentCatalog, getActiveConversation } from '$lib/server/agent/store';
import { saveUpload } from '$lib/server/agent/uploads';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (!isAgentConfigured()) throw error(503, 'Assistant is not configured (set AGENT_BASE_URL in .env)');

	const form = await request.formData();
	const text = String(form.get('text') ?? '').trim();
	const image = form.get('image');
	const hasImage = image instanceof File && image.size > 0;
	if (!text && !hasImage) throw error(400, 'Say something or attach an image');

	let imageName: string | null = null;
	if (hasImage) {
		try {
			imageName = await saveUpload(image);
		} catch (e) {
			throw error(400, e instanceof Error ? e.message : 'Upload failed');
		}
	}

	const conversation = getActiveConversation();
	const messages = await runTurn(conversation.id, text, imageName);
	return json({ conversation, messages, catalog: agentCatalog() });
};
