import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {PEOPLE_API_BASE_URL} from '../utils/contacts-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases({
	groupResourceName: z.string().describe('The resource name of the contact group (e.g., "contactGroups/abc123"). Get this from contact_groups_list.'),
	contactResourceName: z.string().describe('The resource name of the contact to add (e.g., "people/c12345")'),
}, {group: 'groupResourceName', contact: 'contactResourceName'});

const outputSchema = z.object({
	status: z.string(),
	message: z.string(),
}).passthrough();

export function registerContactAddToGroup(server: McpServer, config: Config): void {
	server.registerTool(
		'contact_add_to_group',
		{
			title: 'Add contact to group',
			description: 'Add a contact to a contact group (label). Use contact_groups_list to find the group resource name.',
			inputSchema,
			outputSchema,
		},
		async ({groupResourceName, contactResourceName}) => {
			const url = `${PEOPLE_API_BASE_URL}/${groupResourceName}/members:modify`;
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${config.token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					resourceNamesToAdd: [contactResourceName],
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				return jsonResult(outputSchema.parse({
					status: 'error',
					message: `Add to group failed: ${response.status} ${errorText}`,
				}));
			}

			return jsonResult(outputSchema.parse({
				status: 'success',
				message: 'Contact added to group successfully',
			}));
		},
	);
}
