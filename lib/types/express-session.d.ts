import "express-session";

export type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "DEV";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: number;
      username: string;
      role: UserRole;
    };
  }
}
