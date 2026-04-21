---
name: contacts
description: Manage Google Contacts with full CRUD operations. Works in two modes - via MCP server (claude.ai and Claude Code) or locally via Ruby scripts as fallback. Supports contact lookup, creation, enrichment, photo management, and batch operations.
---

# Google Contacts Management Skill

## About This Skill

This skill lets you interact with and enrich your Google Contacts from Claude — anywhere. It was built to work seamlessly in two environments:

- **On claude.ai** — uses the Google Contacts MCP server (remote, hosted on Vercel)
- **On Claude Code CLI** — also uses the MCP server if connected, OR falls back to local Ruby scripts if MCP is not available

The goal: one consistent workflow for searching, creating, enriching, and managing contacts regardless of where you're using Claude.

---

## How It Works

### Primary: MCP Server (recommended)

The MCP server (`Google Contacts by Hus`) provides all contact operations. It works on both claude.ai and Claude Code CLI.

**MCP Tools:**
- `contact_search` — search by name/email/phone
- `contact_get` — get full contact details by resourceName
- `contact_create` — create contact (names, emails, phones, org, notes, URLs, addresses, birthday)
- `contact_update` — update contact (requires etag from contact_get; supports all fields)
- `contact_delete` — delete a contact
- `contacts_list` — list all contacts with pagination
- `contact_groups_list` — list all labels/groups
- `group_members_list` — list members of a specific group
- `contact_add_to_group` — add a contact to a group/label
- `contact_update_photo` — set contact photo from a public URL
- `directory_search` — search organization directory

**If MCP is NOT connected**, instruct the user:
> To use Google Contacts, install the MCP server:
> 1. Go to Settings → Integrations (claude.ai) or run `claude mcp add` (Claude Code)
> 2. Add: `Google Contacts by Hus` / URL: `https://google-contacts-mcp-hus.vercel.app`
> 3. Authorize with your Google account when prompted

### Fallback: Local Ruby Scripts (deprecated)

If running in Claude Code CLI without MCP connected, the local Ruby script at `~/.claude/skills/contacts/scripts/contacts_manager.rb` can be used as a fallback.

> **Note:** Ruby mode is deprecated. Prefer connecting the MCP server even in Claude Code CLI. Ruby mode is kept only for the `--photo-file` feature (uploading photos from local disk), which MCP cannot do.

**Authentication**: Shared OAuth token at `~/.claude/.google/token.json`

---

## Rules (ALWAYS follow these)

- **Google Contacts link**: Always show `https://contacts.google.com/person/{resource_id}` after create/update/view. resource_id = part after "people/" (e.g., `people/c1234` → `https://contacts.google.com/person/c1234`)
- **Note timestamps**: Always prefix notes with today's date: `YYYY-MM-DD Note text here`
- **X not Twitter**: All Twitter/X references use platform name **X** and URL `https://x.com/` — never "Twitter"
- Activity log entries (under `--\nlogs:`) also use `YYYY-MM-DD` format

## URL Type Standards

Always use these exact type strings when setting URLs on contacts:
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

## Social Media Lookup on Contact Creation

When creating a new contact, ALWAYS perform an online search to find their social media profiles before saving:

1. **Search online** using WebSearch:
   - `"Full Name" LinkedIn`
   - `"Full Name" GitHub`
   - `"Full Name" X site:x.com`
   - `"Full Name" Instagram`
   - `"Full Name" Facebook`
   - `"Full Name" company title`
   - Use any additional context (company, location, etc.) to refine

2. **Collect confirmed info** — only include data you are confident belongs to this specific person:
   - Social media URLs
   - Company name and job title

3. **Create the contact:**
   ```
   contact_create(
     givenName: "John",
     familyName: "Doe",
     organization: "Acme Corp",
     jobTitle: "Senior Engineer",
     emailAddresses: [{value: "john@acme.com", type: "work"}],
     urls: [
       {value: "https://www.linkedin.com/in/johndoe/", type: "LinkedIn"},
       {value: "https://github.com/johndoe", type: "GitHub"}
     ],
     notes: "2026-04-21 Met at conference"
   )
   ```

4. **Only include confirmed matches** — do not guess.

5. **Set a profile photo:**
   ```
   contact_update_photo(resourceName: "people/cXXX", photoUrl: "https://github.com/johndoe.png")
   ```
   Photo source priority:
   1. `https://unavatar.io/x/{handle}` (X/Twitter)
   2. `https://github.com/{username}.png` (GitHub)
   3. `https://unavatar.io/instagram/{handle}` (Instagram)
   4. Personal/company website headshots
   5. LinkedIn — NOT directly accessible; ask user to save file, then use Ruby fallback `--photo-file`

6. **Ask for a label/tag** after creation:
   - Run `contact_groups_list()` to get available groups
   - Present top suggestions sorted by member count:
     ```
     Which tag would you like to add?
     1. .NS (7 members)
     2. Consensus (34 members)
     3. blockChain (19 members)
     4. None / skip
     ```
   - Apply: `contact_add_to_group(groupResourceName: "contactGroups/XXX", contactResourceName: "people/cXXX")`

---

## Contact Enrichment (keyword: "enrich")

When the user says **"enrich"** for a contact, perform full online research before updating.

### Step 1 — Fetch current contact data

```
contact_get(resourceName: "people/cXXX")
```

Check what's already filled (emails, phones, urls, photo).

### Step 2 — Identify missing fields, search only for those

Only search for what's **missing**:
- Missing social URLs → search online
- Missing email → search company pages, LinkedIn
- Missing phone → search public directories
- Missing organization/title → search LinkedIn, personal site
- Missing photo → only if not already set

### Step 3 — Present findings

```
📋 Enrichment Report: John Doe
─────────────────────────────────────────
SOCIAL MEDIA
  ✅ LinkedIn   https://linkedin.com/in/johndoe
  ✅ GitHub     https://github.com/johndoe
  ℹ️ X          already on contact
  ❌ Instagram  Not found
ORGANIZATION
  ✅ Company    Acme Corp
  ✅ Title      Senior Engineer
CONTACT INFO
  ℹ️ Email     already on contact
  ✅ Phone     +1 555 123 4567 (found via company page)
PHOTO
  ✅ Available  https://github.com/johndoe.png (GitHub avatar)
─────────────────────────────────────────
Approve all updates? (or specify which ones)
```

### Step 4 — Wait for user approval

Do NOT update anything until the user confirms.

### Step 5 — Apply approved updates

```
contact_update(
  resourceName: "people/cXXX",
  etag: "...",
  organization: "Acme Corp",
  jobTitle: "Senior Engineer",
  phoneNumbers: [{value: "+1 555 123 4567", type: "work"}],
  urls: [{value: "https://linkedin.com/in/johndoe", type: "LinkedIn"}]
)

contact_update_photo(resourceName: "people/cXXX", photoUrl: "https://github.com/johndoe.png")
```

---

## Contact Photo Update

```
# From public URL (MCP — primary)
contact_update_photo(resourceName: "people/c123", photoUrl: "https://github.com/username.png")

# From local file (Ruby fallback only — for when image is on disk)
contacts_manager.rb --update-photo "people/c123" --photo-file "/path/to/image.png"
```

### Photo display workflow (Claude Code CLI):
1. Download options to temp files: `curl -sL "URL" -o /tmp/photo_opt_N.jpg`
2. Use Read tool on each file to render inline
3. Check if placeholder — skip if generic
4. Show numbered options, wait for user to pick
5. Upload with `contact_update_photo` or Ruby `--photo-file`

---

## Operations Quick Reference

| Operation | Command |
|---|---|
| Search | `contact_search(query: "John Smith", pageSize: 10)` (max 30) |
| Get details | `contact_get(resourceName: "people/c123")` |
| List all | `contacts_list(pageSize: 100)` |
| Create | `contact_create(givenName: "John", familyName: "Doe", ...)` |
| Update | `contact_update(resourceName: "people/c123", etag: "...", ...)` |
| Delete | `contact_delete(resourceName: "people/c123")` |
| List groups | `contact_groups_list()` |
| Group members | `group_members_list(groupResourceName: "contactGroups/XXX")` |
| Add to group | `contact_add_to_group(groupResourceName: "...", contactResourceName: "...")` |
| Update photo | `contact_update_photo(resourceName: "...", photoUrl: "...")` |
| Directory search | `directory_search(query: "...")` |

---

## Best Practices

1. **Search before create** — always check for duplicates first
2. **Enrich on creation** — search online for social profiles before saving
3. **Timestamp notes** — always prefix with `YYYY-MM-DD`
4. **Ask for label** — after every creation, prompt for a group/tag
5. **Use etag** — always get current etag before updating (prevents conflicts)
6. **Google Contacts link** — always show after create/update/view
7. **Careful deletes** — confirm before deleting, it's permanent
8. **Only confirmed data** — never guess social profiles or org info

---

## Ruby Fallback Reference (deprecated)

Use only when MCP is not available or for `--photo-file` (local file upload).

| Operation | Ruby Command |
|---|---|
| Search | `contacts_manager.rb --search "query"` |
| Get | `contacts_manager.rb --get "people/c123"` |
| List | `contacts_manager.rb --list --page-size 100` |
| Create | `contacts_manager.rb --create '{JSON}'` |
| Update | `contacts_manager.rb --update "people/c123" --update-data '{JSON}' --update-mask "fields"` |
| Delete | `contacts_manager.rb --delete "people/c123"` |
| Photo (URL) | `contacts_manager.rb --update-photo "people/c123" --photo-url "URL"` |
| Photo (file) | `contacts_manager.rb --update-photo "people/c123" --photo-file "/path/to/file"` |
| List groups | `contacts_manager.rb --list-groups` |
| Add to group | `contacts_manager.rb --add-to-group "contactGroups/XXX" --contact-resource "people/cXXX"` |

**Auth troubleshooting:**
```bash
rm ~/.claude/.google/token.json
contacts_manager.rb --list  # triggers re-auth
```

Token must include scope: `https://www.googleapis.com/auth/contacts`
