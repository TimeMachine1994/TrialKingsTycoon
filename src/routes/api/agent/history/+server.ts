import { agentCatalog, getActiveConversation, listMessages, newConversation } from '$lib/server/agent/store';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const conversation = getActiveConversation();
	return json({ conversation, messages: listMessages(conversation.id), catalog: agentCatalog() });
};

/** Starts a fresh conversation (the previous one is kept in the database). */
export const POST: RequestHandler = () => {
	const conversation = newConversation();
	return json({ conversation, messages: [], catalog: agentCatalog() });
};
