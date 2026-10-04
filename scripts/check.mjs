// Checks what no single client's validator can: that each plugin's OpenAI/Copilot
// manifest pair (plugin.json, mcp.json) and its Claude pair (.claude-plugin/plugin.json,
// .mcp.json) describe the same plugin, and that both marketplaces list the same plugins.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const errors = [];
const fail = (msg) => errors.push(msg);

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = async (name) =>
  ajv.compile(await (await fetch(`https://agent-plugins.org/schemas/1.0.0/${name}.schema.json`)).json());
const validatePlugin = await schema("plugin");
const validateMcp = await schema("mcp");

// Agent Plugins uses `streamable-http`; Claude Code's .mcp.json calls the same transport `http`.
const transport = { "streamable-http": "http", sse: "sse", stdio: "stdio" };

const plugins = readdirSync(join(root, "plugins"));
for (const name of plugins) {
  const dir = `plugins/${name}`;
  const portable = read(`${dir}/plugin.json`);
  const claude = read(`${dir}/.claude-plugin/plugin.json`);
  if (!validatePlugin(portable)) fail(`${dir}/plugin.json: ${ajv.errorsText(validatePlugin.errors)}`);
  for (const key of ["name", "version", "description", "license", "homepage", "repository"]) {
    if (portable[key] !== claude[key]) fail(`${dir}: ${key} differs (${portable[key]} vs ${claude[key]})`);
  }
  if (portable.name !== name) fail(`${dir}: name ${portable.name} must match its directory`);

  const ui = portable.extensions?.["com.openai"]?.interface ?? {};
  for (const key of ["composerIcon", "logo"]) {
    if (ui[key] && !existsSync(join(root, dir, ui[key]))) fail(`${dir}: ${key} ${ui[key]} not found`);
  }
  if ((ui.shortDescription ?? "").length > 30) fail(`${dir}: shortDescription over 30 chars`);
  if ((ui.defaultPrompt ?? []).some((p) => p.length > 128)) fail(`${dir}: a defaultPrompt is over 128 chars`);

  const hasPortableMcp = existsSync(join(root, dir, "mcp.json"));
  const hasClaudeMcp = existsSync(join(root, dir, ".mcp.json"));
  if (hasPortableMcp !== hasClaudeMcp) fail(`${dir}: mcp.json and .mcp.json must both exist or both be absent`);
  if (hasPortableMcp && hasClaudeMcp) {
    const a = read(`${dir}/mcp.json`);
    const b = read(`${dir}/.mcp.json`).mcpServers;
    if (!validateMcp(a)) fail(`${dir}/mcp.json: ${ajv.errorsText(validateMcp.errors)}`);
    const keys = (o) => Object.keys(o).sort().join(",");
    if (keys(a.mcpServers) !== keys(b)) fail(`${dir}: MCP server names differ between mcp.json and .mcp.json`);
    for (const [key, server] of Object.entries(a.mcpServers)) {
      const other = b[key];
      if (!other) continue;
      if (transport[server.type] !== other.type) fail(`${dir}: ${key} transport ${server.type} vs ${other.type}`);
      if (server.url !== other.url) fail(`${dir}: ${key} url differs`);
    }
  }
}

const codex = read(".agents/plugins/marketplace.json").plugins;
const claude = read(".claude-plugin/marketplace.json").plugins;
const listed = (entries, source) =>
  entries.map((e) => `${e.name}=${source(e)}`).sort().join(" ");
const expected = plugins.map((n) => `${n}=./plugins/${n}`).sort().join(" ");
if (listed(codex, (e) => e.source.path) !== expected) fail(".agents/plugins/marketplace.json does not list every plugin under plugins/");
if (listed(claude, (e) => e.source) !== expected) fail(".claude-plugin/marketplace.json does not list every plugin under plugins/");

if (errors.length) {
  for (const e of errors) console.error(`✘ ${e}`);
  process.exit(1);
}
console.log(`✔ ${plugins.length} plugin(s) consistent across OpenAI, Copilot and Claude manifests`);
