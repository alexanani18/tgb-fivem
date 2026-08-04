"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LoaderCircle, UserPlus } from "lucide-react";

import AppShell from "../../components/AppShell";

type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "GUEST";
type Information = "GUEST" | "ACCES UTILIZATOR";

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
  const [role, setRole] = useState<UserRole>("GUEST");

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
          password: "tgb",
          role: role,
        }),
      });

      const data = (await response.json()) as CreateUserResponse;

      if (!response.ok) {
        setErrorMessage(data.message || "Utilizatorul nu a putut fi creat.");
        return;
      }

      setSuccessMessage(
        `Utilizatorul ${
          data.user?.username ?? normalizedUsername
        } a fost creat cu succes.`,
      );

      setUsername("");
      setRole("GUEST");
    } catch (error) {
      console.error("Create user request error:", error);

      setErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 backdrop-blur-md">
          <p className="text-sm tracking-[0.2em] text-[#B8904D] uppercase">
            Control Panel
          </p>

          <h1 className="mt-3 text-3xl font-bold text-white">
            Adaugă utilizator
          </h1>

          <p className="mt-4 max-w-2xl text-zinc-300">Creează un cont nou.</p>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-2xl border border-white/10 bg-black/30 p-6">
              <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white">
                  <UserPlus size={21} />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Date utilizator
                  </h2>

                  <p className="mt-1 text-sm text-zinc-400">
                    Completează câmpul de mai jos.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-zinc-200"
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
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 hover:border-white/20 focus:border-green-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <p className="text-xs text-zinc-500">Minimum 3 caractere.</p>
                </div>

                {errorMessage && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                  >
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div
                    role="status"
                    className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-[#B8904D]"
                  >
                    <CheckCircle2 size={18} className="shrink-0" />

                    <span>{successMessage}</span>
                  </div>
                )}

                <div className="flex justify-end border-t border-white/10 pt-5">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-w-52 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
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

            <aside className="h-fit rounded-2xl border border-white/10 bg-black/30 p-5">
              <h2 className="text-lg font-semibold text-white">
                Roluri disponibile
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                Selectează accesul potrivit pentru cont.
              </p>

              <div className="mt-5 space-y-3">
                <RoleCard
                  title="GUEST"
                  description="Acest rol este pentru persoanele noi angajate. Acestea trebuie sa completeze un formular de angajare pentru a putea fi promovate la rolul de ANGAJAT."
                />

                <RoleCard
                  title="ACCES UTILIZATOR"
                  description="Parola pentru conturile noi este generată automat și poate fi schimbată ulterior de către utilizator. (`tgb`)"
                />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

interface RoleCardProps {
  title: Information;
  description: string;
}

function RoleCard({ title, description }: RoleCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-[#B8904D]">{title}</p>

      <p className="mt-2 text-xs leading-5 text-zinc-400">{description}</p>
    </div>
  );
}
