"use client";

import { useCallback, useEffect, useState } from "react";

import AppShell from "../../components/AppShell";

import UniformCard from "./components/UniformCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

interface Uniform {
  id: number;
  type: "MALE" | "FEMALE";
  title: string;
  image_path: string | null;
  store_name: string;
  shoes_rack: number;
  pants_rack: number;
  jacket_rack: number;
  hat_rack: number;
  updated_by: number | null;
  updated_at: string;
}

interface UniformsResponse {
  success: boolean;
  message?: string;
  uniforms?: Uniform[];
}

interface SessionUser {
  id: number;
  username: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE" | "GUEST";
}

interface SessionResponse {
  success: boolean;
  user: SessionUser;
}

export default function UniformPage() {
  const [uniforms, setUniforms] = useState<Uniform[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const loadUniforms = useCallback(async () => {


    setIsLoading(true);
    setErrorMessage(null);

    try {
      const sessionResponse = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const sessionData = (await sessionResponse.json()) as SessionResponse;

      if (!sessionResponse.ok || !sessionData.success) {
        throw new Error("Sesiunea nu a putut fi verificată.");
      }

      setSessionUser(sessionData.user);

      const response = await fetch(`${API_URL}/api/uniforms`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });



      const data = (await response.json()) as UniformsResponse;



      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Uniformele nu au putut fi încărcate.",
        );
      }

      setUniforms(data.uniforms ?? []);
    } catch (error) {
      console.error("Failed to load uniforms:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Uniformele nu au putut fi încărcate.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUniforms();
  }, [loadUniforms]);

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 p-8">
        <header className="space-y-4">
        </header>

        {isLoading && (
          <div className="rounded-2xl border border-[#B8904D]/20 bg-black/40 p-10 text-center">
            <p className="text-zinc-300">Se încarcă uniformele...</p>
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-6">
            <p className="text-red-300">{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && (
          <div className="grid items-start gap-8 xl:grid-cols-2">
            {uniforms.map((uniform) => (
              <UniformCard
                key={uniform.id}
                uniform={uniform}
                isAdmin={sessionUser?.role === "ADMIN"}
                onUpdated={(updatedUniform) => {
                  setUniforms((current) =>
                    current.map((item) =>
                      item.id === updatedUniform.id
                        ? updatedUniform
                        : item,
                    ),
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}