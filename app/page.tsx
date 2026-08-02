"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message ?? "Autentificarea a eșuat.");
        return;
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Login request failed:", error);

      setErrorMessage(
        "Backend-ul nu este disponibil. Verifică dacă serverul Express este pornit.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4"
      style={{
        backgroundImage: "url('/img/login-image.png')",
      }}
    >
      <div className="absolute inset-0 bg-black/65" />

      <section className="relative z-10 w-full max-w-md rounded-2xl border border-green-500/30 bg-black/75 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm uppercase tracking-[0.35em] text-green-500">
            Restricted access
          </p>

          <h1 className="text-4xl font-bold tracking-wider text-white">TGB</h1>

          <p className="mt-3 text-sm text-zinc-400">
            Introdu datele de acces pentru a continua.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Username
            </label>

            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Introdu username-ul"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Parolă
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Introdu parola"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            />
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg border border-green-500 bg-green-600 px-4 py-3 font-semibold tracking-wide text-white transition hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "SE VERIFICĂ..." : "AUTENTIFICARE"}
          </button>
        </form>
      </section>
    </main>
  );
}
