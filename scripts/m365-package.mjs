// Builds the Microsoft 365 app package: the files in microsoft-365/appPackage, zipped
// flat, with ${{NAME}} placeholders filled from the environment. Microsoft 365
// Copilot reads the zip from Teams Developer Portal, Agents Toolkit or Partner Center.
//
//   HAVEIBEENSQUATTED_AUTH_CONFIG_ID=... npm run package:m365
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

const root = new URL("..", import.meta.url).pathname;
const source = join(root, "plugins/haveibeensquatted/microsoft-365/appPackage");
const manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8"));

const missing = new Set();
const fill = (text) =>
  text.replace(/\$\{\{([A-Z0-9_]+)\}\}/g, (_, name) => {
    const value = process.env[name];
    if (!value) missing.add(name);
    return value ?? "";
  });

const entries = readdirSync(source)
  .sort()
  .map((name) => {
    const raw = readFileSync(join(source, name));
    return { name, data: extname(name) === ".json" ? Buffer.from(fill(raw.toString("utf8"))) : raw };
  });
if (missing.size) {
  console.error(`✘ set ${[...missing].join(", ")} (the Teams Developer Portal auth config ID)`);
  process.exit(1);
}

// A minimal zip writer (deflate, no directories), so the package needs no dependency.
const local = [];
const central = [];
let offset = 0;
for (const { name, data } of entries) {
  const path = Buffer.from(name);
  const body = deflateRawSync(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0);
  head.writeUInt16LE(20, 4);
  head.writeUInt16LE(8, 8);
  head.writeUInt16LE(0x21, 12); // 1980-01-01, so the zip is reproducible
  head.writeUInt32LE(crc32(data), 14);
  head.writeUInt32LE(body.length, 18);
  head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(path.length, 26);
  local.push(head, path, body);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  head.copy(entry, 8, 6, 30);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, path);
  offset += head.length + path.length + body.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync(join(root, "dist"), { recursive: true });
const out = join("dist", `haveibeensquatted-m365-${manifest.version}.zip`);
writeFileSync(join(root, out), Buffer.concat([...local, directory, end]));
console.log(`✔ ${out}: ${entries.map((e) => e.name).join(", ")}`);
