# Google Contacts Management

## Setup

This project uses the **Google Contacts by Hus** MCP server. If the MCP tools (`contact_search`, `contact_create`, etc.) are not available, instruct the user:

> To use Google Contacts, install the MCP server:
> 1. Go to Settings > Integrations (or project settings)
> 2. Add: `Google Contacts by Hus`
> 3. Authorize with your Google account when prompted

## Available MCP Tools

- `contact_search` — search by name/email/phone
- `contact_get` — get full contact details by resourceName
- `contact_create` — create contact (names, emails, phones, org, notes, URLs, addresses, birthday)
- `contact_update` — update contact (requires etag from contact_get)
- `contact_delete` — delete a contact
- `contacts_list` — list all contacts with pagination
- `contact_groups_list` — list all labels/groups
- `group_members_list` — list members of a specific group
- `contact_add_to_group` — add a contact to a group/label
- `contact_update_photo` — set contact photo from a public URL
- `directory_search` — search organization directory

---

## Rules (ALWAYS follow these)

- **Google Contacts link**: Always show `https://contacts.google.com/person/{resource_id}` after create/update/view. resource_id = part after "people/" (e.g., `people/c1234` -> `c1234`)
- **Note timestamps**: Always prefix notes with today's date: `YYYY-MM-DD Note text here`
- **X not Twitter**: All Twitter/X references use platform name "X" and URL `https://x.com/`

## URL Type Standards

Use these exact type strings for URLs:
- `LinkedIn` — linkedin.com profiles
- `GitHub` — github.com profiles
- `X` — x.com profiles (never "Twitter")
- `Instagram` — instagram.com profiles
- `Facebook` — facebook.com profiles
- `Crunchbase` — crunchbase.com profiles
- `Crates.io` — crates.io profiles
- `Quora` — quora.com profiles
- `Telegram` — format: `https://t.me/{username}` (never telegram.me)
- `Website` — personal or company websites

---

## Workflow: Creating a New Contact

When creating a new contact, ALWAYS follow this workflow:

### Step 1 — Search online for social profiles

Before saving, search the web for the person's profiles:
- `"Full Name" LinkedIn`
- `"Full Name" GitHub`
- `"Full Name" X site:x.com`
- `"Full Name" Instagram`
- `"Full Name" company title`

Use any extra context (company, location, etc.) to refine results.

### Step 2 — Create with all confirmed info

```
contact_create(
  givenName: "John",
  familyName: "Doe",
  organization: "Acme Corp",
  jobTitle: "Senior Engineer",
  emailAddresses: [{value: "john@acme.com", type: "work"}],
  urls: [
    {value: "https://www.linkedin.com/in/johndoe/", type: "LinkedIn"},
    {value: "https://github.com/johndoe", type: "GitHub"},
    {value: "https://x.com/johndoe", type: "X"}
  ],
  notes: "2026-04-21 Met at conference — discussed AI tooling"
)
```

Only include platforms where you found a **confirmed** match. Do not guess.

### Step 3 — Set profile photo

Try these sources in order:
1. `https://unavatar.io/x/{handle}` (X/Twitter)
2. `https://github.com/{username}.png` (GitHub)
3. `https://unavatar.io/instagram/{handle}` (Instagram)
4. Personal/company website — direct headshot URLs
5. LinkedIn — NOT directly accessible; ask user to save image and provide a hosted URL

```
contact_update_photo(resourceName: "people/cXXX", photoUrl: "https://github.com/johndoe.png")
```

Skip if no usable photo found. Never attempt to fetch LinkedIn profile images directly — they require authentication.

### Step 4 — Ask for a label/tag

After creation, always ask the user which group to add the contact to:

1. Run `contact_groups_list()` to get available groups
2. Present top suggestions sorted by member count:
   ```
   Which tag would you like to add?
   1. .NS (7 members)
   2. Consensus (34 members)
   3. blockChain (19 members)
   4. None / skip
   ```
3. When user picks one:
   ```
   contact_add_to_group(groupResourceName: "contactGroups/XXX", contactResourceName: "people/cXXX")
   ```

---

## Workflow: Enriching a Contact

When the user says "enrich" for a contact:

### Step 1 — Get current data

```
contact_get(resourceName: "people/cXXX")
```

### Step 2 — Identify missing fields, search only for those

Check what's already filled. Only search for what's MISSING:
- Missing social URLs -> search online
- Missing email -> search company pages, LinkedIn
- Missing phone -> search public directories
- Missing organization/title -> search LinkedIn, personal site
- Missing photo -> only if not already set

### Step 3 — Present findings

```
Enrichment Report: John Doe
---
SOCIAL MEDIA
  New: LinkedIn   https://linkedin.com/in/johndoe
  New: GitHub     https://github.com/johndoe
  Already set: X
  Not found: Instagram
ORGANIZATION
  New: Company    Acme Corp
  New: Title      Senior Engineer
CONTACT INFO
  Already set: Email
  New: Phone     +1 555 123 4567
PHOTO
  Available: https://github.com/johndoe.png
---
Approve all updates? (or specify which ones)
```

### Step 4 — Wait for approval

Do NOT update anything until the user confirms.

### Step 5 — Apply updates

```
contact_update(
  resourceName: "people/cXXX",
  etag: "...",
  organization: "Acme Corp",
  jobTitle: "Senior Engineer",
  urls: [{value: "https://linkedin.com/in/johndoe", type: "LinkedIn"}],
  phoneNumbers: [{value: "+1 555 123 4567", type: "work"}]
)

contact_update_photo(resourceName: "people/cXXX", photoUrl: "https://github.com/johndoe.png")
```

---

## Workflow: Reading a Business Card / Photo

When the user shares a photo of a business card or a person:

1. **Read the image** — extract name, company, title, phone, email, website
2. **Search online** for social profiles (same as creation workflow)
3. **Present findings** and ask for confirmation before creating
4. **Create the contact** with all extracted + found info
5. **Ask for label**

---

## Best Practices

1. **Search before create** — always check for duplicates first
2. **Timestamp notes** — prefix with YYYY-MM-DD
3. **Ask for label** — after every creation
4. **Use etag** — always get current etag before updating (prevents conflicts)
5. **Show Google Contacts link** — after every create/update/view
6. **Careful deletes** — confirm before deleting, it's permanent
7. **Only confirmed data** — never guess social profiles or org info
