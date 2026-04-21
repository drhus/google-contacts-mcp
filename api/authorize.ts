import type {VercelRequest, VercelResponse} from '@vercel/node';
import {getBaseUrl, GOOGLE_CLIENT_ID, GOOGLE_AUTH_ENDPOINT, CONTACTS_SCOPES} from '../src/lib/config.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
	const baseUrl = getBaseUrl(req.headers);

	const clientRedirectUri = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : '';
	const clientState = typeof req.query.state === 'string' ? req.query.state : '';
	const codeChallenge = typeof req.query.code_challenge === 'string' ? req.query.code_challenge : '';
	const codeChallengeMethod = typeof req.query.code_challenge_method === 'string' ? req.query.code_challenge_method : 'S256';

	// Encode client's redirect_uri and state in our state parameter
	const wrappedState = Buffer.from(JSON.stringify({
		redirect_uri: clientRedirectUri,
		state: clientState,
	})).toString('base64url');

	const params = new URLSearchParams({
		client_id: GOOGLE_CLIENT_ID,
		redirect_uri: `${baseUrl}/callback`,
		response_type: 'code',
		scope: CONTACTS_SCOPES.join(' '),
		access_type: 'offline',
		prompt: 'consent',
		state: wrappedState,
		code_challenge: codeChallenge,
		code_challenge_method: codeChallengeMethod,
	});

	res.redirect(302, `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
}
