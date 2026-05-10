#!/usr/bin/env bun
// crawl-discord.ts — fetch OG Squad channels and write to intel.md
// runs standalone: bun crawl-discord.ts

import { readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";

const SETTINGS_PATH = join(
  process.env.HOME!,
  ".tenzin/runtime/.claude/claudeclaw/settings.json"
);
const GUILD_ID = "1498747808969130155";
const OUT_DIR = join(import.meta.dir);

const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
const TOKEN = process.env.DISCORD_TOKEN?.trim() || settings?.discord?.token?.trim();

if (!TOKEN) {
  console.error("no discord token found");
  process.exit(1);
}

const headers = {
  Authorization: `Bot ${TOKEN}`,
  "Content-Type": "application/json",
};

async function get(path: string) {
  const res = await fetch(`https://discord.com/api/v10${path}`, { headers });
  if (!res.ok) throw new Error(`discord api ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchMessages(channelId: string, limit = 100): Promise<any[]> {
  try {
    return await get(`/channels/${channelId}/messages?limit=${limit}`);
  } catch (e: any) {
    console.warn(`  skip channel ${channelId}: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log("fetching channels...");
  const channels: any[] = await get(`/guilds/${GUILD_ID}/channels`);

  // filter to text channels (type 0)
  const textChannels = channels.filter((c: any) => c.type === 0);
  console.log(`found ${textChannels.length} text channels`);

  const sections: string[] = [
    `# discord crawl — OG Squad\n\n**crawled**: ${new Date().toISOString()}\n**channels**: ${textChannels.length}\n\n---\n`,
  ];

  for (const ch of textChannels) {
    console.log(`  → #${ch.name}`);
    const msgs: any[] = await fetchMessages(ch.id, 100);
    if (!msgs.length) continue;

    sections.push(`## #${ch.name} (${msgs.length} messages)\n`);
    // msgs come newest-first, reverse for chronological
    for (const m of msgs.reverse()) {
      const author = m.author?.username ?? "unknown";
      const ts = m.timestamp?.slice(0, 10) ?? "";
      const content = m.content?.replace(/\n/g, " ").trim();
      if (!content) continue;
      sections.push(`- [${ts}] **${author}**: ${content}`);
    }
    sections.push("");

    // rate limit: 50 req/s, be conservative
    await Bun.sleep(500);
  }

  const outPath = join(OUT_DIR, "discord-crawl.md");
  writeFileSync(outPath, sections.join("\n"));
  console.log(`\nwritten to ${outPath}`);
}

main().catch(console.error);
