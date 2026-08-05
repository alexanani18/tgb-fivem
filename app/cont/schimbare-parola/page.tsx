"use client";

import { FormEvent, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import AppShell from "@/app/components/AppShell";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("Completează toate câmpurile.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Parola nouă trebuie să aibă minimum 8 caractere.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Parolele noi nu coincid.");
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage("Parola nouă trebuie să fie diferită de parola actuală.");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(
        "http://localhost:5000/auth/schimbare-parola",
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        },
      );

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(data.message ?? "Parola nu a putut fi schimbată.");
        return;
      }

      setSuccessMessage(data.message ?? "Parola a fost schimbată cu succes.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Change password request error:", error);

      setErrorMessage(
        "Backendul nu poate fi contactat. Verifică dacă serverul este pornit.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <main className="min-h-screen px-5 py-6 text-white md:px-8 md:py-8">
        <div className="mx-auto w-full">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-sm text-white/50">
              <span>Cont</span>
              <span>/</span>
              <span className="text-emerald-400">Schimbă parola</span>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
                <KeyRound className="h-6 w-6 text-emerald-400" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Schimbă parola
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                  Actualizează parola contului tău. După modificare, folosește
                  noua parolă la următoarea autentificare.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/45 shadow-2xl backdrop-blur-md">
              <div className="border-b border-white/10 px-6 py-5 md:px-8">
                <div className="flex items-center gap-3">
                  <LockKeyhole className="h-5 w-5 text-emerald-400" />

                  <div>
                    <h2 className="font-medium text-white">
                      Date de securitate
                    </h2>

                    <p className="mt-1 text-sm text-white/45">
                      Introdu parola actuală și alege o parolă nouă.
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-6 px-6 py-6 md:px-8 md:py-8"
              >
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
                    className="flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <PasswordField
                  id="current-password"
                  label="Parola actuală"
                  placeholder="Introdu parola actuală"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  showPassword={showCurrentPassword}
                  onTogglePassword={() =>
                    setShowCurrentPassword((currentValue) => !currentValue)
                  }
                  autoComplete="current-password"
                />

                <div className="h-px bg-white/10" />

                <PasswordField
                  id="new-password"
                  label="Parola nouă"
                  placeholder="Introdu parola nouă"
                  value={newPassword}
                  onChange={setNewPassword}
                  showPassword={showNewPassword}
                  onTogglePassword={() =>
                    setShowNewPassword((currentValue) => !currentValue)
                  }
                  autoComplete="new-password"
                />

                <PasswordField
                  id="confirm-password"
                  label="Confirmă parola nouă"
                  placeholder="Reintrodu parola nouă"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  showPassword={showConfirmPassword}
                  onTogglePassword={() =>
                    setShowConfirmPassword((currentValue) => !currentValue)
                  }
                  autoComplete="new-password"
                />

                <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setErrorMessage("");
                      setSuccessMessage("");
                    }}
                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    Resetează
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <KeyRound className="h-4 w-4" />

                    {isSubmitting
                      ? "Se actualizează..."
                      : "Actualizează parola"}
                  </button>
                </div>
              </form>
            </section>

            <aside className="h-fit rounded-2xl border border-white/10 bg-black/45 p-6 shadow-2xl backdrop-blur-md">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>

              <h2 className="text-lg font-medium">Recomandări de securitate</h2>

              <p className="mt-2 text-sm leading-6 text-white/50">
                Folosește o parolă diferită de cele utilizate pe alte conturi.
              </p>

              <div className="mt-6 space-y-4">
                <SecurityRequirement text="Minimum 8 caractere" />
                <SecurityRequirement text="Folosește litere mari și mici" />
                <SecurityRequirement text="Adaugă numere și simboluri" />
                <SecurityRequirement text="Nu reutiliza parola actuală" />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  autoComplete: "current-password" | "new-password";
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  showPassword,
  onTogglePassword,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-white/80"
      >
        {label}
      </label>

      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-11 pr-12 text-sm text-white outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/10"
        />

        <button
          type="button"
          onClick={onTogglePassword}
          aria-label={showPassword ? "Ascunde parola" : "Afișează parola"}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 transition hover:text-emerald-400"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}

function SecurityRequirement({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-white/60">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
      </div>

      <span>{text}</span>
    </div>
  );
}
