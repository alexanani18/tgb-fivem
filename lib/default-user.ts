import "dotenv/config";

import bcrypt from "bcryptjs";
import { db } from "./db";

async function createUser() {
  try {
    const username = "vladimir";
    const password = "asd";
    const role = "ADMIN";

    const passwordHash = await bcrypt.hash(password, 12);

    await db.execute(
      `
        INSERT INTO users (
          username,
          password_hash,
          user_role,
          is_active
        )
        VALUES (?, ?, ?, 1)
      `,
      [username, passwordHash, role],
    );

    console.log("✅ Utilizator creat cu succes.");
    console.log(`Username: ${username}`);
    console.log(`Rol: ${role}`);
  } catch (error) {
    console.error("❌ Utilizatorul nu a putut fi creat:");
    console.error(error);
  } finally {
    await db.end();
  }
}

createUser();
