import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makePeopleApiCall} from '../utils/contacts-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {personSchema, PERSON_FIELDS_SUMMARY} from '../utils/person-fields.js';

const inputSchema = strictSchemaWithAliases({
	query: z.string().describe('Search query - matches against names, email addresses, and phone numbers'),
	pageSize: z.number().min(1).max(30).default(10).describe('Maximum number of results (max 30)'),
}, {});

const outputSchema = z.object({
	results: z.array(z.object({
		person: personSchema,
	})).optional(),
});

export function registerContactSearch(server: McpServer, config: Config): void {
	server.registerTool(
		'contact_search',
		{
			title: 'Search contacts',
			description: 'Search for contacts by name, email, or phone number. Returns full contact details including birthdays, addresses, notes, and URLs.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({query, pageSize}) => {
			const params = new URLSearchParams();
			params.set('query', query);
			params.set('readMask', PERSON_FIELDS_SUMMARY);
			params.set('pageSize', String(pageSize));

			const result = await makePeopleApiCall('GET', `/people:searchContacts?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}
