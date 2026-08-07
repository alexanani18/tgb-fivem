import { Client, GatewayIntentBits } from "discord.js";

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

let isDiscordClientStarted = false;

export async function startDiscordClient(): Promise<void> {
  if (isDiscordClientStarted) {
    return;
  }

  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is not configured.");
  }

  await discordClient.login(token);

  isDiscordClientStarted = true;

  console.log(`🤖 Logged in as ${discordClient.user?.tag}`);
}