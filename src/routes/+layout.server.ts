import { isAgentConfigured } from '$lib/server/agent/config';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	return { agentEnabled: isAgentConfigured() };
};
