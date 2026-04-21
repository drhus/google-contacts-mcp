import type {VercelRequest, VercelResponse} from '@vercel/node';
import {getBaseUrl, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_ENDPOINT} from '../src/lib/config.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST');
		res.status(405).json({error: 'Method not allowed'});
		return;
	}

	const baseUrl = getBaseUrl(req.headers);

	const body = new URLSearchParams({
		...(req.body as Record<string, string>),
		client_id: GOOGLE_CLIENT_ID,
		client_secret: GOOGLE_CLIENT_SECRET,
		redirect_uri: `${baseUrl}/callback`,
	});

	try {
		const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
			method: 'POST',
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			body: body.toString(),
		});
		const data = await response.json();
		res.status(response.status).json(data);
	} catch (error) {
		console.error('Token exchange error:', error);
		res.status(500).json({error: 'server_error', error_description: 'Token exchange failed'});
	}
}
