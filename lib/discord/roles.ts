import { db } from "../db";
import { discordClient } from "./client";

export async function importDiscordRoles(): Promise<void> {
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!guildId) {
    throw new Error("DISCORD_GUILD_ID is not configured.");
  }

  const guild = await discordClient.guilds.fetch(guildId);

  const roles = await guild.roles.fetch();

  let synchronized = 0;

  for (const role of roles.values()) {
    if (!role || role.managed) {
      continue;
    }

    await db.execute(
      `
        INSERT INTO discord_roles (
          discord_role_id,
          name
        )
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name)
      `,
      [role.id, role.name],
    );

    synchronized++;
  }

  console.log(`✅ Synchronized: ${synchronized} roles`);
}