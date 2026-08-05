import "dotenv/config";

import express from "express";
import cors from "cors";
import session from "express-session";
import path from "node:path";
import multer from "multer";

import { db } from "./db";
import authRoutes from "./routes/auth";
import notificationRoutes from "./routes/notifications";
import notificationSubmissionRoutes from "./routes/notificationSubmissions";
import { cleanupExpiredNotifications } from "./services/notificationCleanup";
import userRoutes from "./routes/users";
import contractRoutes from "./routes/contracts";
import uniformRoutes from "./routes/uniforms";

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
  "/notification-submissions",
  express.static(
    path.join(process.cwd(), "public", "notification-submissions"),
  ),
);

app.use(
  "/contract-images",
  express.static(path.join(process.cwd(), "public", "contract-images")),
);

app.use(
  "/uniforms",
  express.static(
    path.join(process.cwd(), "public", "uniforms"),
  ),
);

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
app.use("/api/notification-submissions", notificationSubmissionRoutes);
app.use("/users", userRoutes);
app.use("/contracts", contractRoutes);
app.use("/api/uniforms", uniformRoutes);

/*
|--------------------------------------------------------------------------
| Eventual Error Handling Middleware
|--------------------------------------------------------------------------
*/

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Poza buletinului poate avea maximum 5 MB.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Fișierul încărcat nu este valid.",
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  },
);

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

      void cleanupExpiredNotifications();

      setInterval(() => {
        void cleanupExpiredNotifications();
      }, 60 * 1000);
    });
  } catch (error) {
    console.error("❌ Database connection failed.");
    console.error(error);

    process.exit(1);
  }
}

startServer();
