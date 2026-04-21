import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makePeopleApiCall} from '../utils/contacts-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {personSchema, PERSON_FIELDS_SUMMARY} from '../utils/person-fields.js';

const inputSchema = strictSchemaWithAliases({
	pageSize: z.number().min(1).max(1000).default(100).describe('Maximum number of contacts to return'),
	pageToken: z.string().optional().describe('Page token for pagination'),
	sortOrder: z.enum(['LAST_MODIFIED_ASCENDING', 'LAST_MODIFIED_DESCENDING', 'FIRST_NAME_ASCENDING', 'LAST_NAME_ASCENDING']).optional().describe('Sort order for results'),
}, {});

const outputSchema = z.object({
	connections: z.array(personSchema).optional(),
	nextPageToken: z.string().optional(),
	totalPeople: z.number().optional(),
	totalItems: z.number().optional(),
});

export function registerContactsList(server: McpServer, config: Config): void {
	server.registerTool(
		'contacts_list',
		{
			title: 'List contacts',
			description: 'List contacts from the user\'s Google Contacts. Returns names, emails, phone numbers, organizations, birthdays, addresses, notes, and URLs.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({pageSize, pageToken, sortOrder}) => {
			const params = new URLSearchParams();
			params.set('personFields', PERSON_FIELDS_SUMMARY);
			params.set('pageSize', String(pageSize));

			if (pageToken) {
				params.set('pageToken', pageToken);
			}

			if (sortOrder) {
				params.set('sortOrder', sortOrder);
			}

			const result = await makePeopleApiCall('GET', `/people/me/connections?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}
