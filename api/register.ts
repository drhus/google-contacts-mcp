import type {VercelRequest, VercelResponse} from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST');
		res.status(405).json({error: 'Method not allowed'});
		return;
	}

	const body = req.body || {};

	res.status(201).json({
		...body,
		client_id: 'google-contacts-mcp',
		client_id_issued_at: Math.floor(Date.now() / 1000),
	});
}
