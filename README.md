# Google Contacts MCP Server

MCP server for Google Contacts — search, create, enrich, and manage contacts from Claude (or any MCP client).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/drhus/google-contacts-mcp&env=GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET)

## Features

- **Full CRUD** — create, read, update, delete contacts
- **Search** — find contacts by name, email, or phone
- **URLs & Social Links** — store LinkedIn, GitHub, X, Instagram, etc.
- **Photos** — set contact photos from public URLs
- **Groups/Labels** — list groups, add contacts to groups
- **Addresses & Birthdays** — full contact field support
- **Directory Search** — search your organization's directory
- **OAuth proxy** — no tokens stored server-side

## Use Cases

- **Contact enrichment**: "Enrich John Doe" — searches online for social profiles, company info, and photos, then updates the contact
- **Business card capture**: Snap a photo of a business card, Claude extracts details and creates the contact
- **Network lookup**: "Who do I know at Google?" or "Show me contacts tagged blockChain"
- **Quick add**: "Add Sarah Chen from Acme Corp, she's a PM" — creates contact with online-sourced profiles

## Quick Start

### Step 1: Deploy the MCP Server

Options 1, 2, 4, and 5 require a running MCP server. Deploy your own:

1. Click the **Deploy with Vercel** button above (or clone and deploy manually)
2. Set environment variables:
   - `GOOGLE_CLIENT_ID` — from [Google Cloud Console](#google-oauth-setup)
   - `GOOGLE_CLIENT_SECRET` — from [Google Cloud Console](#google-oauth-setup)
3. Add your deployment URL + `/callback` to Google OAuth **Authorized redirect URIs**
   - e.g. `https://your-deployment.vercel.app/callback`

---

### Option 1: Use on claude.ai (MCP)

Requires: MCP server deployed (Step 1 above)

1. Open a claude.ai Project
2. Go to Project Settings → Integrations
3. Add MCP server URL: `https://your-deployment.vercel.app/mcp`
4. Authorize with your Google account when prompted
5. (Optional) Paste [`skill/SKILL-claude-ai.md`](skill/SKILL-claude-ai.md) into Project Instructions for enrichment workflows

### Option 2: Use with Claude Code CLI (MCP)

Requires: MCP server deployed (Step 1 above)

```bash
claude mcp add --transport http google-contacts https://your-deployment.vercel.app/mcp
```

Then install the skill for enrichment workflows:
```bash
cp -r skill/ ~/.claude/skills/contacts/
```

### Option 3: Use with Claude Code CLI (Skill)

No MCP server needed — use the Ruby scripts directly in Claude Code CLI.

1. Clone and install the skill:
   ```bash
   git clone https://github.com/drhus/google-contacts-mcp.git
   cp -r google-contacts-mcp/skill/ ~/.claude/skills/contacts/
   ```

2. Install Ruby dependencies:
   ```bash
   cd ~/.claude/skills/contacts
   bundle install
   ```

3. Set up Google OAuth locally:
   - Place your `client_secret.json` at `~/.claude/.google/client_secret.json`
   - Run any command to trigger auth flow:
     ```bash
     ~/.claude/skills/contacts/scripts/contacts_manager.rb --list
     ```
   - Follow the browser prompt to authorize

See [`skill/SETUP.md`](skill/SETUP.md) for detailed local setup instructions.

### Option 4: Run MCP server locally

Instead of deploying to Vercel, run the server on your machine:

```bash
git clone https://github.com/drhus/google-contacts-mcp.git
cd google-contacts-mcp
npm install
GOOGLE_CLIENT_ID='your-id' GOOGLE_CLIENT_SECRET='your-secret' MCP_TRANSPORT=http npm start
```

Then add to Claude Code:
```bash
claude mcp add --transport http google-contacts http://localhost:3000/mcp
```

### Option 5: Use with other MCP clients

Any MCP-compatible client can connect to your deployed server at:
```
https://your-deployment.vercel.app/mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `contacts_list` | List contacts with pagination |
| `contact_search` | Search by name, email, or phone |
| `contact_get` | Get full contact details |
| `contact_create` | Create a new contact (names, emails, phones, org, URLs, addresses, birthday, notes) |
| `contact_update` | Update an existing contact (all fields, requires etag) |
| `contact_delete` | Permanently delete a contact |
| `contact_update_photo` | Set contact photo from a public URL |
| `contact_add_to_group` | Add a contact to a group/label |
| `contact_groups_list` | List all contact groups/labels |
| `group_members_list` | List members of a specific group |
| `directory_search` | Search organization directory |

## Skill (Claude AI workflows)

This repo includes a **skill file** that teaches Claude how to use the MCP tools effectively:

- **Auto-enrichment** — searches online for social profiles before creating contacts
- **Photo sourcing** — finds profile photos via unavatar.io/GitHub
- **Label management** — prompts for group assignment after creation
- **Consistent formatting** — timestamps on notes, standardized URL types

| File | Use for |
|------|---------|
| [`skill/SKILL.md`](skill/SKILL.md) | Claude Code CLI (full skill with Ruby fallback) |
| [`skill/SKILL-claude-ai.md`](skill/SKILL-claude-ai.md) | claude.ai Projects (paste into Project Instructions) |

## Architecture

```
MCP Client (Claude) ←→ google-contacts-mcp ←→ Google OAuth / People API
```

The server acts as an OAuth proxy:
1. `/.well-known/oauth-authorization-server` — advertises OAuth endpoints
2. `/register` — returns Google OAuth client credentials
3. `/authorize` → redirects to Google OAuth
4. `/callback` → forwards auth code to client
5. `/token` → proxies token exchange with Google
6. `/mcp` → handles MCP tool calls using bearer token

**No tokens or state stored server-side.** The server is stateless.

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable the **People API**
4. **APIs & Services** → **OAuth consent screen** → configure
5. **APIs & Services** → **Credentials** → **Create OAuth client ID** → **Web application**
6. Add redirect URI: `https://your-domain.vercel.app/callback`
7. Copy Client ID and Client Secret to your environment variables

## Credits

Based on [domdomegg/google-contacts-mcp](https://github.com/domdomegg/google-contacts-mcp). Extended with:
- URL/social links support in create/update
- Photo upload from URL
- Add-to-group functionality
- Address and birthday fields
- Contact enrichment skill/workflow

## License

MIT
