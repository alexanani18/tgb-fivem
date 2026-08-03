"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import DashboardSidebar, { type UserRole } from "./SideBar";

interface SessionUser {
  id: number;
  username: string;
  role: UserRole;
}

interface AppShellProps {
  children: ReactNode;
  backgroundImage: string;
}

interface SessionResponse {
  user: SessionUser;
}

export default function AppShell({ children, backgroundImage }: AppShellProps) {
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("http://localhost:5000/auth/me", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          router.replace("/");
          return;
        }

        const data = (await response.json()) as SessionResponse;

        setUser(data.user);
      } catch (error) {
        console.error("Session check failed:", error);
        router.replace("/");
      } finally {
        setIsLoading(false);
      }
    }

    void checkSession();
  }, [router]);

  if (isLoading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backgroundImage})`,
          }}
        />

        <div className="absolute inset-0 bg-black/80" />

        <div className="relative flex flex-col items-center gap-5">
          <RefreshCw className="h-10 w-10 animate-spin text-green-500" />

          <p className="text-sm tracking-[0.2em] text-zinc-300 uppercase">
            Se verifică sesiunea
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
        }}
      />

      <div className="fixed inset-0 bg-black/55" />

      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(0,0,0,0.62)_100%)]" />

      <div className="relative z-10 flex min-h-screen">
        <DashboardSidebar username={user.username} role={user.role} />

        <section className="min-w-0 flex-1 overflow-y-auto">{children}</section>
      </div>
    </main>
  );
}
