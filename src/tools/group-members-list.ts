import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makePeopleApiCall} from '../utils/contacts-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {personSchema, PERSON_FIELDS_SUMMARY} from '../utils/person-fields.js';

const inputSchema = strictSchemaWithAliases({
	groupResourceName: z.string().describe('The resource name of the contact group (e.g., "contactGroups/abc123"). Get this from contact_groups_list.'),
	pageSize: z.number().min(1).max(1000).default(100).describe('Maximum number of members to return'),
}, {group: 'groupResourceName'});

const outputSchema = z.object({
	memberResourceNames: z.array(z.string()).optional(),
	members: z.array(personSchema).optional(),
	nextPageToken: z.string().optional(),
	totalSize: z.number().optional(),
});

export function registerGroupMembersList(server: McpServer, config: Config): void {
	server.registerTool(
		'group_members_list',
		{
			title: 'List group members',
			description: 'List all contacts in a specific contact group (label). First use contact_groups_list to find the group resource name, then pass it here.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({groupResourceName, pageSize}) => {
			// Step 1: Get member resource names from the group
			const groupParams = new URLSearchParams();
			groupParams.set('groupFields', 'name,groupType,memberCount');
			groupParams.set('maxMembers', String(pageSize));

			const groupResult = await makePeopleApiCall('GET', `/${groupResourceName}?${groupParams.toString()}`, config.token) as {
				memberResourceNames?: string[];
			};

			const memberResourceNames = groupResult.memberResourceNames ?? [];

			if (memberResourceNames.length === 0) {
				return jsonResult(outputSchema.parse({memberResourceNames: [], members: []}));
			}

			// Step 2: Batch-get the member details
			const batchParams = new URLSearchParams();
			batchParams.set('personFields', PERSON_FIELDS_SUMMARY);
			for (const name of memberResourceNames) {
				batchParams.append('resourceNames', name);
			}

			const batchResult = await makePeopleApiCall('GET', `/people:batchGet?${batchParams.toString()}`, config.token) as {
				responses?: Array<{person?: unknown}>;
			};

			const members = (batchResult.responses ?? [])
				.map(r => r.person)
				.filter((p): p is Record<string, unknown> => p != null)
				.map(p => personSchema.parse(p));

			return jsonResult(outputSchema.parse({
				memberResourceNames,
				members,
				totalSize: memberResourceNames.length,
			}));
		},
	);
}
