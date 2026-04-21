import type {VercelRequest, VercelResponse} from '@vercel/node';
import {getBaseUrl, CONTACTS_SCOPES} from '../../src/lib/config.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
	const baseUrl = getBaseUrl(req.headers);

	res.json({
		issuer: baseUrl,
		authorization_endpoint: `${baseUrl}/authorize`,
		token_endpoint: `${baseUrl}/token`,
		registration_endpoint: `${baseUrl}/register`,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		code_challenge_methods_supported: ['S256'],
		scopes_supported: CONTACTS_SCOPES,
	});
}
