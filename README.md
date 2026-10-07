# Have I Been Squatted agent plugins

Plugins that connect AI agents to [Have I Been Squatted](https://haveibeensquatted.com): analyze any domain live, scan for typosquats and unregistered lookalikes, and search certificate transparency. With a monitoring plan, also query and triage your organization's detections and alerts, manage its monitored domains and detection rules, and open takedowns.

The `haveibeensquatted` plugin connects the hosted MCP server at `https://mcp.haveibeensquatted.com/mcp`. You sign in with your Have I Been Squatted account the first time a tool runs and choose which organization to connect. Every call is scoped to that organization and to your role in it.

## Install

**ChatGPT and Codex.** Once the listing is live, install **Have I Been Squatted** from the Plugins directory. To install from this repository:

```sh
codex plugin marketplace add haveibeensquatted/agent-plugins
codex plugin add haveibeensquatted@haveibeensquatted
```

ChatGPT workspace admins can import this repository as a GitHub-backed workspace marketplace; see OpenAI's [plugin management](https://learn.chatgpt.com/docs/enterprise/plugin-management) guide.

**Claude Code**

```sh
claude plugin marketplace add haveibeensquatted/agent-plugins
claude plugin install haveibeensquatted@haveibeensquatted
```

On claude.ai, Claude Desktop and mobile, add **Have I Been Squatted** from the Connectors directory instead.

**GitHub Copilot CLI**

```sh
copilot plugin marketplace add haveibeensquatted/agent-plugins
copilot plugin install haveibeensquatted@haveibeensquatted
```

**Microsoft 365 Copilot.** Once the listing is live, add **Have I Been Squatted** from the Agent Store in Copilot, or ask your Microsoft 365 admin to deploy it. It works in Copilot Chat without a Microsoft 365 Copilot license. To build and sideload the app package, see [`plugins/haveibeensquatted/microsoft-365`](plugins/haveibeensquatted/microsoft-365/README.md).

**Any other MCP client.** Add `https://mcp.haveibeensquatted.com/mcp` as a remote (Streamable HTTP) server. It uses OAuth with dynamic client registration, so no client ID is needed.

## Tools

**Lookups**, on every plan. Scans run as background jobs that take from seconds to about 15 minutes.

| Tool | What it does |
| --- | --- |
| `analyze` | Live DNS, registration, hosting, HTTP and classification for one domain, with a verdict profile |
| `squat` | Scan a domain for registered and live typosquats, ranked by evidence |
| `discover` | Find unregistered lookalikes of a domain that could still be registered defensively |
| `ct_search` | Search certificate transparency for names matching a regular expression |
| `get_job` | Check on a scan and page through its results |
| `show_domain`, `show_domains` | Show a scanned domain, or a scan's results, as an interactive view with a screenshot and map |

**Your organization**, on Pro, Business and Enterprise plans.

| Tool | What it does |
| --- | --- |
| `query`, `describe_catalog` | Search your lookalike results, Email Intelligence events or Site Canary events from the last 30 days, and the query language reference |
| `annotate_result`, `add_result` | Tag a result as owned, ignored, false positive or malicious; add an analyzed domain to a monitored domain's results |
| `list_alerts`, `get_alert`, `set_alert_status` | Review the alerts your rules raised, where each response was delivered, and triage them |
| `list_domains`, `add_domains`, `update_domain`, `remove_domain` | Manage the domains you monitor and their detection settings |
| `list_rules`, `get_rule`, `list_rule_actions`, `validate_rule`, `create_rule`, `update_rule`, `set_rule_enabled`, `delete_rule` | Read, write and test detection rules and their responses |
| `list_takedowns`, `get_takedown`, `create_takedown`, `add_takedown_update`, `link_takedown` | Follow and open takedown cases (Takedowns add-on) |
| `whoami` | The connected user, organization, plan, role and granted scopes |

The server lists only the tools your organization's plan includes. Tools that change your organization's data need an organization admin, and the agent should confirm with you before calling them.

## Layout

One directory carries a manifest for every client. The OpenAI and Copilot files follow the vendor-neutral [Agent Plugins](https://agent-plugins.org) format. Claude Code reads only its own files.

```
.agents/plugins/marketplace.json     Codex, ChatGPT workspace import
.claude-plugin/marketplace.json      Claude Code, Copilot CLI
plugins/haveibeensquatted/
  plugin.json                        Agent Plugins manifest; OpenAI listing fields under extensions.com.openai
  mcp.json                           Agent Plugins MCP config (type "streamable-http")
  .claude-plugin/plugin.json         Claude Code manifest
  .mcp.json                          Claude Code MCP config (type "http")
  assets/                            icon (256 px) and logo (1024 px)
  microsoft-365/appPackage/          Microsoft 365 app package: declarative agent with the MCP server as its action
```

Shared fields must match across both pairs: name, version, description, MCP server names and URLs. `npm run check` enforces that, validates the Agent Plugins schemas, and checks that both marketplaces list every plugin. It also validates the Microsoft 365 package against Microsoft's schemas and store naming rules, and checks that its MCP URL matches `mcp.json`. CI also runs `claude plugin validate --strict` and installs the marketplace with the Codex and Copilot CLIs.

## Releasing

Bump `version` in both `plugin.json` files together. Claude Code and Codex keep users on the installed version until it changes. The Microsoft 365 package has its own `version` in `manifest.json`, bumped for each store submission.

The MCP server's tools ship from the server, not from this repository, so a tool change needs no release here. Release only when a manifest, asset or skill changes.

## Support

[haveibeensquatted.com/contact](https://haveibeensquatted.com/contact) · [Privacy](https://haveibeensquatted.com/about/privacy) · [Terms](https://haveibeensquatted.com/about/terms)
