import { startDiscordClient } from "./client";

export async function startupDiscord(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    console.log("⚠️ Discord is not configured.");
    return;
  }

  try {
    await startDiscordClient();

    console.log("✅ Discord bot started successfully.");
  } catch (error) {
    console.error("❌ Failed to start Discord bot.");
    console.error(error);
  }
}