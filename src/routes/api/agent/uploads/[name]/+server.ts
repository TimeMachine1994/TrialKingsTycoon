import { readUpload } from '$lib/server/agent/uploads';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const file = readUpload(params.name);
	if (!file) throw error(404, 'Image not found');
	return new Response(new Uint8Array(file.bytes), {
		headers: {
			'Content-Type': file.mime,
			'Content-Length': String(file.bytes.byteLength),
			'Cache-Control': 'private, max-age=31536000'
		}
	});
};
