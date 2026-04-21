import type {VercelRequest, VercelResponse} from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
	const code = typeof req.query.code === 'string' ? req.query.code : '';
	const wrappedState = typeof req.query.state === 'string' ? req.query.state : '';
	const error = typeof req.query.error === 'string' ? req.query.error : '';

	try {
		const {redirect_uri: clientRedirectUri, state: clientState} = JSON.parse(
			Buffer.from(wrappedState, 'base64url').toString(),
		) as {redirect_uri: string; state: string};

		const params = new URLSearchParams();
		if (code) {
			params.set('code', code);
		}

		if (clientState) {
			params.set('state', clientState);
		}

		if (error) {
			params.set('error', error);
		}

		res.redirect(302, `${clientRedirectUri}?${params.toString()}`);
	} catch {
		res.status(400).json({error: 'invalid_state', error_description: 'Could not decode state parameter'});
	}
}
