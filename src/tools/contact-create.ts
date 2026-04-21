import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makePeopleApiCall} from '../utils/contacts-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {personSchema} from '../utils/person-fields.js';

const inputSchema = strictSchemaWithAliases({
	givenName: z.string().optional().describe('First name'),
	familyName: z.string().optional().describe('Last name'),
	emailAddresses: z.array(z.object({
		value: z.string().describe('Email address'),
		type: z.string().optional().describe('Type of email (e.g. home, work, other)'),
	})).optional().describe('Email addresses'),
	phoneNumbers: z.array(z.object({
		value: z.string().describe('Phone number'),
		type: z.string().optional().describe('Type of phone (e.g. home, work, mobile, other)'),
	})).optional().describe('Phone numbers'),
	organization: z.string().optional().describe('Company/organization name'),
	jobTitle: z.string().optional().describe('Job title'),
	notes: z.string().optional().describe('Notes about the contact'),
	urls: z.array(z.object({
		value: z.string().describe('URL'),
		type: z.string().optional().describe('Type of URL (e.g. LinkedIn, GitHub, X, Website, Instagram, Facebook, Telegram)'),
	})).optional().describe('Website URLs and social media links'),
	addresses: z.array(z.object({
		streetAddress: z.string().optional().describe('Street address'),
		city: z.string().optional().describe('City'),
		region: z.string().optional().describe('State/region'),
		postalCode: z.string().optional().describe('Postal/ZIP code'),
		country: z.string().optional().describe('Country'),
		type: z.string().optional().describe('Type of address (e.g. home, work)'),
	})).optional().describe('Physical addresses'),
	birthday: z.object({
		year: z.number().optional().describe('Year (optional)'),
		month: z.number().describe('Month (1-12)'),
		day: z.number().describe('Day (1-31)'),
	}).optional().describe('Birthday'),
}, {});

export function registerContactCreate(server: McpServer, config: Config): void {
	server.registerTool(
		'contact_create',
		{
			title: 'Create contact',
			description: 'Create a new contact in Google Contacts. Supports names, emails, phones, organization, notes, URLs/social links, addresses, and birthday.',
			inputSchema,
			outputSchema: personSchema,
		},
		async ({givenName, familyName, emailAddresses, phoneNumbers, organization, jobTitle, notes, urls, addresses, birthday}) => {
			const person: Record<string, unknown> = {};

			if (givenName || familyName) {
				person.names = [{givenName, familyName}];
			}

			if (emailAddresses?.length) {
				person.emailAddresses = emailAddresses;
			}

			if (phoneNumbers?.length) {
				person.phoneNumbers = phoneNumbers;
			}

			if (organization || jobTitle) {
				person.organizations = [{name: organization, title: jobTitle}];
			}

			if (notes) {
				person.biographies = [{value: notes, contentType: 'TEXT_PLAIN'}];
			}

			if (urls?.length) {
				person.urls = urls;
			}

			if (addresses?.length) {
				person.addresses = addresses;
			}

			if (birthday) {
				person.birthdays = [{date: birthday}];
			}

			const result = await makePeopleApiCall('POST', '/people:createContact', config.token, person);
			return jsonResult(personSchema.parse(result));
		},
	);
}
