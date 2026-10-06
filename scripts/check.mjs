// Checks what no single client's validator can: that each plugin's OpenAI/Copilot
// manifest pair (plugin.json, mcp.json) and its Claude pair (.claude-plugin/plugin.json,
// .mcp.json) describe the same plugin, and that both marketplaces list the same plugins.
// A plugin's Microsoft 365 app package (microsoft-365/appPackage) is checked against
// Microsoft's schemas and the store rules its validators don't cover.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import AjvDraft04 from "ajv-draft-04";
import addFormats from "ajv-formats";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const errors = [];
const fail = (msg) => errors.push(msg);

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schema = async (name) =>
  ajv.compile(await (await fetch(`https://agent-plugins.org/schemas/1.0.0/${name}.schema.json`)).json());
const validatePlugin = await schema("plugin");
const validateMcp = await schema("mcp");

// Microsoft's manifest schemas are draft-04, so they need their own Ajv.
const ajv04 = addFormats(new AjvDraft04({ allErrors: true, strict: false }));
const microsoft = async (url) =>
  ajv04.compile(await (await fetch(`https://developer.microsoft.com/json-schemas/${url}`)).json());
const m365Schemas = {
  app: await microsoft("teams/v1.30/MicrosoftTeams.schema.json"),
  agent: await microsoft("copilot/declarative-agent/v1.8/schema.json"),
  plugin: await microsoft("copilot/plugin/v2.4/schema.json"),
};
const validateWith = (validate, file, doc) => {
  if (!validate(doc)) fail(`${file}: ${ajv04.errorsText(validate.errors)}`);
};
const pngSize = (path) => {
  const png = readFileSync(path);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};

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

  const m365 = `${dir}/microsoft-365/appPackage`;
  if (existsSync(join(root, m365))) checkM365(m365, portable, hasPortableMcp ? read(`${dir}/mcp.json`) : null);
}

function checkM365(dir, portable, mcp) {
  const app = read(`${dir}/manifest.json`);
  validateWith(m365Schemas.app, `${dir}/manifest.json`, app);
  const refs = app.copilotAgents?.declarativeAgents ?? [];
  if (refs.length !== 1) return fail(`${dir}/manifest.json: expected one declarative agent`);
  const agentFile = `${dir}/${refs[0].file}`;
  const agent = read(agentFile);
  validateWith(m365Schemas.agent, agentFile, agent);

  for (const [key, size] of [["color", 192], ["outline", 32]]) {
    const icon = join(root, dir, app.icons[key]);
    if (!existsSync(icon)) { fail(`${dir}: ${key} icon not found`); continue; }
    const [w, h] = pngSize(icon);
    if (w !== size || h !== size) fail(`${dir}: ${key} icon is ${w}x${h}, must be ${size}x${size}`);
  }

  // Store rule: the app, agent and every plugin carry the same name.
  const names = [["manifest.json name.short", app.name.short], [`${refs[0].file} name`, agent.name]];
  const starters = agent.conversation_starters ?? [];
  if (starters.length < 3) fail(`${agentFile}: the store requires at least three conversation starters`);
  // Store rule: no URLs in the agent's description, instructions or starters.
  const prose = [agent.description, agent.instructions, ...starters.flatMap((s) => [s.title, s.text])];
  if (prose.some((t) => /https?:\/\//i.test(t ?? ""))) fail(`${agentFile}: description, instructions and starters must not contain URLs`);

  const servers = new Set(Object.values(mcp?.mcpServers ?? {}).map((s) => s.url));
  for (const action of agent.actions ?? []) {
    const file = `${dir}/${action.file}`;
    const plugin = read(file);
    validateWith(m365Schemas.plugin, file, plugin);
    names.push([`${action.file} name_for_human`, plugin.name_for_human]);
    if (plugin.name_for_human.length > 20) fail(`${file}: name_for_human over 20 chars`);
    for (const runtime of plugin.runtimes ?? []) {
      if (runtime.type === "RemoteMCPServer" && !servers.has(runtime.spec.url))
        fail(`${file}: MCP url ${runtime.spec.url} is not in the plugin's mcp.json`);
    }
  }
  if (new Set(names.map(([, n]) => n)).size !== 1)
    fail(`${dir}: names differ (${names.map(([k, n]) => `${k}=${n}`).join(", ")})`);
  if (app.developer.privacyUrl !== portable.extensions?.["com.openai"]?.interface?.privacyPolicyURL)
    fail(`${dir}/manifest.json: privacyUrl differs from plugin.json`);
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
console.log(`✔ ${plugins.length} plugin(s) consistent across OpenAI, Copilot, Claude and Microsoft 365 manifests`);
