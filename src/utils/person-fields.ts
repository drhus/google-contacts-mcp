// Shared person fields and schema used across tools

import {z} from 'zod';

// Full set of person fields to request from the People API
export const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,organizations,photos,birthdays,addresses,biographies,urls,memberships';

// Lighter set for search/list (no memberships to reduce payload)
export const PERSON_FIELDS_SUMMARY = 'names,emailAddresses,phoneNumbers,organizations,photos,birthdays,addresses,biographies,urls';

// Reusable person schema with all fields
export const personSchema = z.object({
	resourceName: z.string(),
	etag: z.string().optional(),
	names: z.array(z.object({
		displayName: z.string().optional(),
		givenName: z.string().optional(),
		familyName: z.string().optional(),
		middleName: z.string().optional(),
	})).optional(),
	emailAddresses: z.array(z.object({
		value: z.string().optional(),
		type: z.string().optional(),
	})).optional(),
	phoneNumbers: z.array(z.object({
		value: z.string().optional(),
		type: z.string().optional(),
	})).optional(),
	organizations: z.array(z.object({
		name: z.string().optional(),
		title: z.string().optional(),
		department: z.string().optional(),
	})).optional(),
	photos: z.array(z.object({
		url: z.string().optional(),
	})).optional(),
	birthdays: z.array(z.object({
		date: z.object({
			year: z.number().optional(),
			month: z.number().optional(),
			day: z.number().optional(),
		}).optional(),
	})).optional(),
	addresses: z.array(z.object({
		formattedValue: z.string().optional(),
		type: z.string().optional(),
		streetAddress: z.string().optional(),
		city: z.string().optional(),
		region: z.string().optional(),
		postalCode: z.string().optional(),
		country: z.string().optional(),
	})).optional(),
	biographies: z.array(z.object({
		value: z.string().optional(),
	})).optional(),
	urls: z.array(z.object({
		value: z.string().optional(),
		type: z.string().optional(),
	})).optional(),
	memberships: z.array(z.object({
		contactGroupMembership: z.object({
			contactGroupResourceName: z.string().optional(),
		}).optional(),
	})).optional(),
}).passthrough();
