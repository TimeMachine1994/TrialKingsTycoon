import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Images dropped into the assistant chat live here until (if) they become receipt attachments. */
export const AGENT_UPLOADS_DIR = path.resolve('data', 'agent-uploads');
fs.mkdirSync(AGENT_UPLOADS_DIR, { recursive: true });

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const IMAGE_EXT: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'image/gif': '.gif'
};

const EXT_MIME: Record<string, string> = Object.fromEntries(
	Object.entries(IMAGE_EXT).map(([mime, ext]) => [ext, mime])
);

const SAFE_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/;

export function isImageMime(mime: string): boolean {
	return mime in IMAGE_EXT;
}

export async function saveUpload(file: File): Promise<string> {
	if (!isImageMime(file.type)) {
		throw new Error(`The assistant only accepts images (JPEG/PNG/WebP/GIF), not ${file.type || 'this file type'}`);
	}
	if (file.size <= 0) throw new Error('Image is empty');
	if (file.size > MAX_UPLOAD_BYTES) {
		throw new Error(`Image too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)`);
	}
	const name = `${crypto.randomUUID()}${IMAGE_EXT[file.type]}`;
	fs.writeFileSync(path.join(AGENT_UPLOADS_DIR, name), Buffer.from(await file.arrayBuffer()));
	return name;
}

export function uploadPath(name: string): string | null {
	if (!SAFE_NAME.test(name)) return null;
	const p = path.join(AGENT_UPLOADS_DIR, name);
	return fs.existsSync(p) ? p : null;
}

export function uploadMime(name: string): string {
	return EXT_MIME[path.extname(name)] ?? 'application/octet-stream';
}

export function readUpload(name: string): { mime: string; bytes: Buffer } | null {
	const p = uploadPath(name);
	if (!p) return null;
	return { mime: uploadMime(name), bytes: fs.readFileSync(p) };
}

export function uploadDataUrl(name: string): string | null {
	const f = readUpload(name);
	return f ? `data:${f.mime};base64,${f.bytes.toString('base64')}` : null;
}
