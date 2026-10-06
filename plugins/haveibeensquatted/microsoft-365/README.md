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

This writes `dist/haveibeensquatted-m365-<version>.zip`. To try it, upload the zip under Teams → Apps → Manage your apps → Upload an app, then open the agent in Microsoft 365 Copilot.

`npm run check` validates the three manifests against Microsoft's schemas. It also checks that their names match, that there are at least three conversation starters, that the agent's text contains no URLs, that the MCP URL matches `mcp.json`, and that the icons are the right sizes.
