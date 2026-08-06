import { discordClient, startDiscordClient } from "./client";
import { importDiscordRoles } from "./roles";

export async function syncDiscordRoles(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    console.log("⚠️ Discord is not configured. Skipping role import.");
    return;
  }

  try {
    await startDiscordClient();

    await importDiscordRoles();

    console.log("✅ Discord roles synchronized.");
  } catch (error) {
    console.warn("⚠️ Discord role synchronization failed.");
    console.warn(error);
  } finally {
    discordClient.destroy();
  }
}