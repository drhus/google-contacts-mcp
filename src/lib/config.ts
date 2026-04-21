// Shared configuration for Vercel serverless handlers

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export const CONTACTS_SCOPES = [
	'https://www.googleapis.com/auth/contacts',
	'https://www.googleapis.com/auth/directory.readonly',
];

export function getBaseUrl(headers: Record<string, string | string[] | undefined>): string {
	if (process.env.MCP_BASE_URL) {
		return process.env.MCP_BASE_URL;
	}

	const proto = (Array.isArray(headers['x-forwarded-proto']) ? headers['x-forwarded-proto'][0] : headers['x-forwarded-proto']) || 'https';
	const host = (Array.isArray(headers.host) ? headers.host[0] : headers.host) || 'localhost:3000';
	return `${proto}://${host}`;
}
