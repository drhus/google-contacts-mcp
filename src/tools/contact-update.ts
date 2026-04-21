import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makePeopleApiCall} from '../utils/contacts-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {personSchema} from '../utils/person-fields.js';

const inputSchema = strictSchemaWithAliases({
	resourceName: z.string().describe('The resource name of the contact to update (e.g., "people/c12345")'),
	etag: z.string().describe('The etag from the contact (required to prevent conflicts)'),
	givenName: z.string().optional().describe('First name'),
	familyName: z.string().optional().describe('Last name'),
	emailAddresses: z.array(z.object({
		value: z.string().describe('Email address'),
		type: z.string().optional().describe('Type of email (e.g. home, work, other)'),
	})).optional().describe('Email addresses (replaces existing)'),
	phoneNumbers: z.array(z.object({
		value: z.string().describe('Phone number'),
		type: z.string().optional().describe('Type of phone (e.g. home, work, mobile, other)'),
	})).optional().describe('Phone numbers (replaces existing)'),
	organization: z.string().optional().describe('Company/organization name'),
	jobTitle: z.string().optional().describe('Job title'),
	notes: z.string().optional().describe('Notes about the contact'),
	urls: z.array(z.object({
		value: z.string().describe('URL'),
		type: z.string().optional().describe('Type of URL (e.g. LinkedIn, GitHub, X, Website, Instagram, Facebook, Telegram)'),
	})).optional().describe('Website URLs and social media links (replaces existing)'),
	addresses: z.array(z.object({
		streetAddress: z.string().optional().describe('Street address'),
		city: z.string().optional().describe('City'),
		region: z.string().optional().describe('State/region'),
		postalCode: z.string().optional().describe('Postal/ZIP code'),
		country: z.string().optional().describe('Country'),
		type: z.string().optional().describe('Type of address (e.g. home, work)'),
	})).optional().describe('Physical addresses (replaces existing)'),
	birthday: z.object({
		year: z.number().optional().describe('Year (optional)'),
		month: z.number().describe('Month (1-12)'),
		day: z.number().describe('Day (1-31)'),
	}).optional().describe('Birthday'),
}, {});

export function registerContactUpdate(server: McpServer, config: Config): void {
	server.registerTool(
		'contact_update',
		{
			title: 'Update contact',
			description: 'Update an existing contact. Use contact_get first to retrieve the current etag. Supports names, emails, phones, organization, notes, URLs/social links, addresses, and birthday.',
			inputSchema,
			outputSchema: personSchema,
		},
		async ({resourceName, etag, givenName, familyName, emailAddresses, phoneNumbers, organization, jobTitle, notes, urls, addresses, birthday}) => {
			const person: Record<string, unknown> = {etag};
			const updatePersonFields: string[] = [];

			if (givenName !== undefined || familyName !== undefined) {
				person.names = [{givenName, familyName}];
				updatePersonFields.push('names');
			}

			if (emailAddresses !== undefined) {
				person.emailAddresses = emailAddresses;
				updatePersonFields.push('emailAddresses');
			}

			if (phoneNumbers !== undefined) {
				person.phoneNumbers = phoneNumbers;
				updatePersonFields.push('phoneNumbers');
			}

			if (organization !== undefined || jobTitle !== undefined) {
				person.organizations = [{name: organization, title: jobTitle}];
				updatePersonFields.push('organizations');
			}

			if (notes !== undefined) {
				person.biographies = [{value: notes, contentType: 'TEXT_PLAIN'}];
				updatePersonFields.push('biographies');
			}

			if (urls !== undefined) {
				person.urls = urls;
				updatePersonFields.push('urls');
			}

			if (addresses !== undefined) {
				person.addresses = addresses;
				updatePersonFields.push('addresses');
			}

			if (birthday !== undefined) {
				person.birthdays = [{date: birthday}];
				updatePersonFields.push('birthdays');
			}

			if (updatePersonFields.length === 0) {
				throw new Error('No fields provided to update. Provide at least one field to change.');
			}

			const params = new URLSearchParams();
			params.set('updatePersonFields', updatePersonFields.join(','));

			const result = await makePeopleApiCall('PATCH', `/${resourceName}:updateContact?${params.toString()}`, config.token, person);
			return jsonResult(personSchema.parse(result));
		},
	);
}
