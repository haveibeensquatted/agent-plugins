# Microsoft 365 Copilot

`appPackage/` is a Microsoft 365 app package holding one declarative agent. The agent's only action is the hosted MCP server, so Copilot's own model calls the server's tools.

| File | Schema | What it holds |
| --- | --- | --- |
| `manifest.json` | App manifest 1.30 | App ID, developer, names, descriptions, icons |
| `declarativeAgent.json` | Declarative agent 1.8 | Instructions, conversation starters, the one action |
| `ai-plugin.json` | Plugin manifest 2.4 | `RemoteMCPServer` runtime for `https://mcp.haveibeensquatted.com/mcp` with dynamic tool discovery |
| `color.png`, `outline.png` | | 192 px tile and 32 px outline |

Tools are discovered at runtime, so each organization sees the tools its plan includes and a new tool needs no new package. Users sign in with their Have I Been Squatted account the first time a tool runs.

Keep the app `id` in `manifest.json` unchanged. Bump that file's `version` for each store submission. It is separate from the plugin version in `plugin.json`.

## Build

```sh
npm run package:m365
```

This writes `dist/haveibeensquatted-m365-<version>.zip`, a flat zip of `appPackage/` with the placeholders filled in. To sideload it, go to Teams → Apps → Manage your apps → Upload an app. The tenant needs custom app upload enabled. Then open the agent at `https://m365.cloud.microsoft/chat`. Run the zip through Developer Portal's [store validation](https://dev.teams.microsoft.com/tools/store-validation) before every submission.

`npm run check` validates all three files against Microsoft's schemas. It also enforces the store rules the schemas don't cover:
- the three names match;
- there are at least three conversation starters;
- the agent's description, instructions and starters contain no URLs;
- the MCP URL matches `mcp.json`;
- the icons are the right sizes.

## Widgets

`show_domain` and `show_domains` return an MCP Apps view, which Copilot renders without extra configuration. Copilot serves widgets from `https://a4c367cd1941d8f23dd8c1bec0b7f177e258bd2901e1fde70a7dc86ca32e09d2.widget-renderer.usercontent.microsoft.com`, a SHA-256 of `mcp.haveibeensquatted.com`. Microsoft requires both the MCP server and the identity provider to allow that origin. The Worker currently answers it with `403 origin is not allowed`, so the origin has to be added to the Worker's `MCP_ALLOWED_ORIGINS` (and to Clerk's allowed origins) before widgets are tested.

Copilot supports fullscreen but not the sidebar, and it doesn't send `host-context-changed`. The view already falls back on both.

| Tool | Prompt |
| --- | --- |
| `whoami` | Which Have I Been Squatted account and organization am I connected to? |
| `analyze` | Analyze paypa1-secure-login.com and tell me whether it looks like phishing infrastructure. |
| `squat`, `get_job`, `show_domains` | Scan {monitored domain} for registered typosquats and show me the riskiest ones. (Takes 5 to 10 minutes; ask "check that job again" to poll.) |
| `discover` | Which unregistered lookalikes of {monitored domain} should I register before an attacker does? |
| `show_domain` | Show me the first result from that scan in detail. |
| `ct_search` | Search certificate transparency for new certificates that imitate microsoft-login. |
| `describe_catalog`, `query` | Triage this week's lookalike detections for my organization and flag the ones that look malicious. |
| `annotate_result` | Mark the first detection as a false positive. |
| `list_rules`, `get_rule` | List my organization's detection rules and explain what each one catches. |
| `list_rule_actions` | Which responses can I attach to a rule? |
| `validate_rule`, `create_rule` | Create a rule that flags lookalikes of {monitored domain} that serve a login page. |
| `update_rule` | Raise that rule's score to 0.8. |
| `set_rule_enabled` | Disable that rule. |
| `delete_rule` | Remove that rule. |
