# Microsoft 365 Copilot

`appPackage/` is a Microsoft 365 app package holding one declarative agent. The agent's only action is the hosted MCP server, so Copilot's own model calls the server's tools. There is no bot and no Azure resource.

| File | Schema | What it holds |
| --- | --- | --- |
| `manifest.json` | App manifest 1.30 | Store identity: app ID, developer, names, descriptions, icons |
| `declarativeAgent.json` | Declarative agent 1.8 | Instructions, conversation starters, the one action |
| `ai-plugin.json` | Plugin manifest 2.4 | `RemoteMCPServer` runtime for `https://mcp.haveibeensquatted.com/mcp` with dynamic tool discovery |
| `color.png`, `outline.png` | | 192 px tile and 32 px white-on-transparent outline |

The plugin uses dynamic tool discovery (`functions: []`, `run_for_functions: ["*"]`). Copilot calls `tools/list` with the signed-in user's token, so each organization sees the tools its plan includes, and a new tool needs no resubmission. Copilot screens every new or changed tool definition before activating it.

The app `id` (`119486df-be42-486a-b1c7-05263cefd7e2`) is the listing's permanent identity. Never change it. Bump `version` in `manifest.json` for each store submission. That version is separate from the plugin version in `plugin.json`.

## Sign-in

Copilot signs users in to Clerk through an auth config stored in Microsoft's token vault. `ai-plugin.json` references the auth config by ID as `${{HAVEIBEENSQUATTED_AUTH_CONFIG_ID}}`, which `npm run package:m365` fills in.

Set it up once:

1. **Clerk.** Create an OAuth application on the production instance.
   - Redirect URIs: `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect`, plus `https://vscode.dev/redirect` if Agents Toolkit will fetch tools.
   - Scopes: `user:org:read org:read results:annotate lookups:run rules:write offline_access`.
   - Use a confidential client (it has a secret) and keep PKCE on.

   Use a static client rather than dynamic client registration. Copilot's dynamic registration runs once, at provisioning, so it yields one shared client anyway. A static client is one we named, it shows by name in the `mcp_call` audit rows, and Teams Developer Portal can manage it. Portal can't yet manage dynamically registered configs.
2. **Teams Developer Portal** → Tools → OAuth client registration.
   - Base URL: `https://mcp.haveibeensquatted.com/mcp`.
   - **Restrict usage by org:** Any Microsoft 365 organization.
   - **Restrict usage by app:** Any Teams app. A registration bound to an app ID makes every tool call return 404.
   - Authorization, token and refresh endpoints come from `https://clerk.haveibeensquatted.com/.well-known/oauth-authorization-server`.
   - Enter the Clerk client ID and secret and the scopes above. Keep PKCE enabled.
   - Saving the registration produces the auth config ID.

## Build and sideload

```sh
HAVEIBEENSQUATTED_AUTH_CONFIG_ID=<auth config ID> npm run package:m365
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

## Store submission

Submit the zip as a Microsoft 365 app offer in Partner Center under the Microsoft 365 and Copilot program. The rules that apply most to this agent, from Microsoft's [agent validation guidelines](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/appsource/prepare/review-copilot-validation-guidelines):

- **Latency and availability.** p50 ≤ 2 s, p75 ≤ 5 s, p99 ≤ 9 s, and 99.9% of calls must return a meaningful response. Long work runs as jobs, so `tools/call` stays fast. `ct_search` can take up to its 20 s deadline on a weak pattern, and that is the tool to watch.
- **Confirmation.** Copilot asks before calling any tool with `readOnlyHint: false`. The instructions also tell the model to state the change first.
- **Citations.** Responses must name their sources. The instructions require naming the domain behind every finding.
- **Coverage.** Every tool needs a prompt in the starters, the instructions or the test notes (below).
- **Screenshots.** At least one listing screenshot must show the agent in Copilot.
- **Compatibility.** The agent must work in Teams desktop and web, copilot.microsoft.com, and Copilot in Word.

### Test notes for reviewers

Give reviewers a Business-plan test organization with `mcp_automation` enabled and at least one monitored domain with recent detections, so every tool is listed. Sign in with the test account when Copilot asks, and pick the test organization.

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
