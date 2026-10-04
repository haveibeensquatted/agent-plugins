# Have I Been Squatted agent plugins

Plugins that connect AI agents to [Have I Been Squatted](https://haveibeensquatted.com): analyze any domain live, scan for typosquats and unregistered lookalikes, search certificate transparency, and query and triage your organization's lookalike detections.

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

**Any other MCP client.** Add `https://mcp.haveibeensquatted.com/mcp` as a remote (Streamable HTTP) server. It uses OAuth with dynamic client registration, so no client ID is needed.

## Tools

| Tool | What it does |
| --- | --- |
| `analyze` | Live DNS, registration, hosting, HTTP and classification for one domain, with a verdict profile |
| `ct_search` | Search certificate transparency for names matching a regular expression |
| `squat` | Scan a domain for registered and live typosquats, ranked by evidence (background job) |
| `discover` | Find unregistered lookalikes of a domain (background job) |
| `get_job` | Check on a background job and page through its results |
| `query` | Query your organization's detections from the last 30 days |
| `annotate_result` | Tag a detection as owned, ignored, false positive or malicious (organization admins) |
| `describe_catalog`, `whoami` | Query-language reference, and the connected user, organization and role |

The server lists only the tools your organization's plan includes.

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
```

Shared fields must match across both pairs: name, version, description, MCP server names and URLs. `npm run check` enforces that, validates the Agent Plugins schemas, and checks that both marketplaces list every plugin. CI also runs `claude plugin validate --strict` and installs the marketplace with the Codex and Copilot CLIs.

## Releasing

Bump `version` in both `plugin.json` files together. Claude Code and Codex keep users on the installed version until it changes.

The MCP server's tools ship from the server, not from this repository, so a tool change needs no release here. Release only when a manifest, asset or skill changes.

## Support

[haveibeensquatted.com/contact](https://haveibeensquatted.com/contact) · [Privacy](https://haveibeensquatted.com/about/privacy) · [Terms](https://haveibeensquatted.com/about/terms)
