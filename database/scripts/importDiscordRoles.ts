import "dotenv/config";

import { startDiscordClient } from "../../lib/discord/client";
import { importDiscordRoles } from "../../lib/discord/roles";

async function main() {
  await startDiscordClient();

  await importDiscordRoles();

  process.exit(0);
}

void main();