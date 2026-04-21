import type {VercelRequest, VercelResponse} from '@vercel/node';
import {getBaseUrl, CONTACTS_SCOPES} from '../../src/lib/config.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
	const baseUrl = getBaseUrl(req.headers);

	res.json({
		resource: `${baseUrl}/mcp`,
		authorization_servers: [baseUrl],
		scopes_supported: CONTACTS_SCOPES,
		resource_name: 'Google Contacts MCP Server',
		resource_documentation: 'https://github.com/domdomegg/google-contacts-mcp',
	});
}
