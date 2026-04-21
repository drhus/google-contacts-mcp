import type {VercelRequest, VercelResponse} from '@vercel/node';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {createServer} from '../src/index.js';
import {isTokenValid} from '../src/utils/token-cache.js';

function extractBearerToken(req: VercelRequest): string | undefined {
	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith('Bearer ')) {
		return undefined;
	}

	return authHeader.slice(7);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST');
		res.status(405).json({error: 'Method not allowed'});
		return;
	}

	const token = extractBearerToken(req);

	// Require auth, except for tools/list for discovery
	const method = req.body?.method as string | undefined;
	if (!token && method !== 'tools/list') {
		res.status(401).json({
			jsonrpc: '2.0',
			error: {code: -32001, message: 'Unauthorized: Bearer token required'},
			id: null,
		});
		return;
	}

	// Validate token before processing
	if (token && !await isTokenValid(token)) {
		res.status(401).json({
			jsonrpc: '2.0',
			error: {code: -32001, message: 'Unauthorized: Invalid or expired token'},
			id: null,
		});
		return;
	}

	const server = createServer({token: token ?? ''});

	try {
		const httpTransport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		await server.connect(httpTransport);
		await httpTransport.handleRequest(req, res, req.body);

		res.on('close', () => {
			void httpTransport.close();
			void server.close();
		});
	} catch (error) {
		console.error('Error handling MCP request:', error);
		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: '2.0',
				error: {code: -32603, message: 'Internal server error'},
				id: null,
			});
		}
	}
}
