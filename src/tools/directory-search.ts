import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makePeopleApiCall} from '../utils/contacts-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {personSchema, PERSON_FIELDS_SUMMARY} from '../utils/person-fields.js';

const inputSchema = strictSchemaWithAliases({
	query: z.string().describe('Search query - matches against names, email addresses, and phone numbers'),
	pageSize: z.number().min(1).max(500).default(10).describe('Maximum number of results'),
	pageToken: z.string().optional().describe('Page token for pagination'),
}, {});

const outputSchema = z.object({
	people: z.array(personSchema).optional(),
	nextPageToken: z.string().optional(),
	totalSize: z.number().optional(),
});

export function registerDirectorySearch(server: McpServer, config: Config): void {
	server.registerTool(
		'directory_search',
		{
			title: 'Search directory',
			description: 'Search the organization directory for people (coworkers, etc). Requires directory.readonly scope.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({query, pageSize, pageToken}) => {
			const params = new URLSearchParams();
			params.set('query', query);
			params.set('readMask', PERSON_FIELDS_SUMMARY);
			params.set('sources', 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE');
			params.set('pageSize', String(pageSize));

			if (pageToken) {
				params.set('pageToken', pageToken);
			}

			const result = await makePeopleApiCall('GET', `/people:searchDirectoryPeople?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}
