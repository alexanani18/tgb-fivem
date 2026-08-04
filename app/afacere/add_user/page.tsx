"use client";

import { FormEvent, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  UserPlus,
} from "lucide-react";

type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA";

interface CreateUserResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    username: string;
    role: UserRole;
    isActive: boolean;
  };
}

export default function AddUserPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("ANGAJAT");

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const normalizedUsername = username.trim();

    if (normalizedUsername.length < 3) {
      setErrorMessage("Username-ul trebuie să conțină minimum 3 caractere.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Parola trebuie să conțină minimum 8 caractere.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("http://localhost:5000/users", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: normalizedUsername,
          password,
          role,
        }),
      });

      const data = (await response.json()) as CreateUserResponse;

      if (!response.ok) {
        setErrorMessage(data.message || "Utilizatorul nu a putut fi creat.");
        return;
      }

      setSuccessMessage(
        `Utilizatorul ${data.user?.username ?? normalizedUsername} a fost creat cu succes.`,
      );

      setUsername("");
      setPassword("");
      setRole("ANGAJAT");
      setShowPassword(false);
    } catch (error) {
      console.error("Create user request error:", error);

      setErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-full w-full px-6 py-8 text-white lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-white/45">
            Control Panel
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            Adaugă utilizator
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Creează un cont nou și atribuie rolul potrivit utilizatorului.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-2xl border border-white/10 bg-black/35 p-6 shadow-2xl backdrop-blur-md">
            <div className="mb-6 flex items-center gap-4 border-b border-white/10 pb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <UserPlus size={23} />
              </div>

              <div>
                <h2 className="text-lg font-semibold">Date utilizator</h2>

                <p className="mt-1 text-sm text-white/45">
                  Completează toate câmpurile de mai jos.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-white/80"
                >
                  Username
                </label>

                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Introdu username-ul"
                  autoComplete="off"
                  disabled={isSubmitting}
                  maxLength={100}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-white/35 focus:bg-black/45 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <p className="text-xs text-white/35">
                  Username-ul trebuie să aibă minimum 3 caractere.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-white/80"
                >
                  Parolă
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Introdu parola"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 pr-12 text-sm text-white outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-white/35 focus:bg-black/45 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={isSubmitting}
                    aria-label={
                      showPassword ? "Ascunde parola" : "Afișează parola"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <p className="text-xs text-white/35">
                  Parola trebuie să aibă minimum 8 caractere.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="role"
                  className="text-sm font-medium text-white/80"
                >
                  Rol
                </label>

                <select
                  id="role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none transition hover:border-white/20 focus:border-white/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="ANGAJAT">ANGAJAT</option>
                  <option value="MAFIA">MAFIA</option>
                  <option value="ADMIN">ADMIN</option>
                </select>

                <p className="text-xs text-white/35">
                  Rolul controlează paginile și funcționalitățile disponibile.
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                >
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-300"
                >
                  <CheckCircle2 size={18} />
                  {successMessage}
                </div>
              )}

              <div className="flex justify-end border-t border-white/10 pt-5">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin" />
                      Se creează...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Creează utilizator
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <aside className="h-fit rounded-2xl border border-white/10 bg-black/25 p-5 backdrop-blur-md">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/65">
              Roluri disponibile
            </h2>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold">ANGAJAT</p>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Acces la secțiunea de afacere și la funcțiile destinate
                  angajaților.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold">MAFIA</p>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Acces la secțiunile și task-urile dedicate mafiei.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold">ADMIN</p>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Acces complet, inclusiv control panel și administrarea
                  utilizatorilor.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
