import "dotenv/config";

import express from "express";
import cors from "cors";
import session from "express-session";

import { db } from "./db";
import authRoutes from "./routes/auth";
import notificationRoutes from "./routes/notifications";

const app = express();

const PORT = Number(process.env.API_PORT ?? 5000);

const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  console.error("❌ SESSION_SECRET nu este setat în fișierul .env.");
  process.exit(1);
}

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

app.use(
  session({
    name: "tgb-session",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.use("/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
/*
|--------------------------------------------------------------------------
| Database Test
|--------------------------------------------------------------------------
*/

async function startServer() {
  try {
    const connection = await db.getConnection();

    await connection.query("SELECT 1");

    connection.release();

    console.log("✅ Database connected successfully.");

    app.listen(PORT, () => {
      console.log(`🚀 Express API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Database connection failed.");
    console.error(error);

    process.exit(1);
  }
}

startServer();
