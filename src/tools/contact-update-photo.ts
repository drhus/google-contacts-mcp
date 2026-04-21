import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {PEOPLE_API_BASE_URL} from '../utils/contacts-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases({
	resourceName: z.string().describe('The resource name of the contact (e.g., "people/c12345")'),
	photoUrl: z.string().describe('URL of the photo to set (e.g. GitHub avatar, unavatar.io URL). Must be a publicly accessible image URL.'),
}, {});

const outputSchema = z.object({
	status: z.string(),
	message: z.string(),
	resourceName: z.string(),
}).passthrough();

export function registerContactUpdatePhoto(server: McpServer, config: Config): void {
	server.registerTool(
		'contact_update_photo',
		{
			title: 'Update contact photo',
			description: 'Set a contact\'s photo from a public image URL. Good sources: GitHub avatars (https://github.com/username.png), unavatar.io (https://unavatar.io/x/handle).',
			inputSchema,
			outputSchema,
		},
		async ({resourceName, photoUrl}) => {
			// Step 1: Download the image (with timeout and size limit)
			const imageResponse = await fetch(photoUrl, {signal: AbortSignal.timeout(10_000)});
			if (!imageResponse.ok) {
				return jsonResult(outputSchema.parse({
					status: 'error',
					message: `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`,
					resourceName,
				}));
			}

			const contentLength = imageResponse.headers.get('content-length');
			if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
				return jsonResult(outputSchema.parse({
					status: 'error',
					message: 'Image too large (max 10MB)',
					resourceName,
				}));
			}

			const imageBuffer = await imageResponse.arrayBuffer();
			const photoBytes = Buffer.from(imageBuffer).toString('base64');

			// Step 2: Upload to Google People API
			const url = `${PEOPLE_API_BASE_URL}/${resourceName}:updateContactPhoto`;
			const response = await fetch(url, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${config.token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({photoBytes}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				return jsonResult(outputSchema.parse({
					status: 'error',
					message: `Photo update failed: ${response.status} ${errorText}`,
					resourceName,
				}));
			}

			return jsonResult(outputSchema.parse({
				status: 'success',
				message: 'Contact photo updated successfully',
				resourceName,
			}));
		},
	);
}
