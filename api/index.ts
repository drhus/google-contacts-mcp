import type {VercelRequest, VercelResponse} from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Google Contacts MCP Server</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			background: #0a0a0a;
			color: #e5e5e5;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 2rem;
		}
		.container {
			max-width: 640px;
			width: 100%;
		}
		.badge {
			display: inline-block;
			background: #1a1a2e;
			border: 1px solid #333;
			border-radius: 20px;
			padding: 4px 12px;
			font-size: 12px;
			color: #888;
			margin-bottom: 1.5rem;
		}
		h1 {
			font-size: 2rem;
			font-weight: 600;
			margin-bottom: 0.75rem;
			color: #fff;
		}
		.description {
			color: #888;
			font-size: 1.1rem;
			line-height: 1.6;
			margin-bottom: 2rem;
		}
		.endpoint {
			background: #111;
			border: 1px solid #222;
			border-radius: 8px;
			padding: 1rem 1.25rem;
			margin-bottom: 1.5rem;
			font-family: 'SF Mono', 'Fira Code', monospace;
			font-size: 0.9rem;
			color: #4ade80;
			word-break: break-all;
		}
		.tools {
			margin-bottom: 2rem;
		}
		.tools h2 {
			font-size: 1rem;
			font-weight: 500;
			color: #aaa;
			margin-bottom: 0.75rem;
		}
		.tool-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
			gap: 8px;
		}
		.tool {
			background: #111;
			border: 1px solid #222;
			border-radius: 6px;
			padding: 8px 12px;
			font-size: 0.8rem;
			font-family: 'SF Mono', 'Fira Code', monospace;
			color: #ccc;
		}
		.links {
			display: flex;
			gap: 1rem;
			flex-wrap: wrap;
		}
		.links a {
			color: #60a5fa;
			text-decoration: none;
			font-size: 0.9rem;
		}
		.links a:hover { text-decoration: underline; }
		.footer {
			margin-top: 3rem;
			color: #555;
			font-size: 0.8rem;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="badge">MCP Server</div>
		<h1>Google Contacts</h1>
		<p class="description">
			Search, create, enrich, and manage your Google Contacts from any MCP-compatible AI client.
		</p>

		<div class="endpoint">/mcp</div>

		<div class="tools">
			<h2>Available Tools</h2>
			<div class="tool-grid">
				<div class="tool">contact_search</div>
				<div class="tool">contact_get</div>
				<div class="tool">contact_create</div>
				<div class="tool">contact_update</div>
				<div class="tool">contact_delete</div>
				<div class="tool">contacts_list</div>
				<div class="tool">contact_update_photo</div>
				<div class="tool">contact_add_to_group</div>
				<div class="tool">contact_groups_list</div>
				<div class="tool">group_members_list</div>
				<div class="tool">directory_search</div>
			</div>
		</div>

		<div class="links">
			<a href="https://github.com/drhus/google-contacts-mcp">GitHub</a>
			<a href="https://github.com/drhus/google-contacts-mcp/tree/master/skill">Skill Files</a>
			<a href="/.well-known/oauth-authorization-server">OAuth Metadata</a>
		</div>

		<p class="footer">
			Built with Model Context Protocol (MCP) &middot; Deployed on Vercel
		</p>
	</div>
</body>
</html>`;

	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	res.status(200).send(html);
}
