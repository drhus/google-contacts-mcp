import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makePeopleApiCall} from '../utils/contacts-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases({
	pageSize: z.number().min(1).max(1000).default(200).describe('Maximum number of groups to return'),
	pageToken: z.string().optional().describe('Page token for pagination'),
}, {});

const groupSchema = z.object({
	resourceName: z.string(),
	etag: z.string().optional(),
	name: z.string().optional(),
	formattedName: z.string().optional(),
	groupType: z.string().optional(),
	memberCount: z.number().optional(),
}).passthrough();

const outputSchema = z.object({
	contactGroups: z.array(groupSchema).optional(),
	nextPageToken: z.string().optional(),
	totalItems: z.number().optional(),
});

export function registerContactGroupsList(server: McpServer, config: Config): void {
	server.registerTool(
		'contact_groups_list',
		{
			title: 'List contact groups (labels)',
			description: 'List all contact groups (labels) in the user\'s Google Contacts. Returns group names, resource names, and member counts.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({pageSize, pageToken}) => {
			const params = new URLSearchParams();
			params.set('pageSize', String(pageSize));
			params.set('groupFields', 'name,groupType,memberCount');

			if (pageToken) {
				params.set('pageToken', pageToken);
			}

			const result = await makePeopleApiCall('GET', `/contactGroups?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}
