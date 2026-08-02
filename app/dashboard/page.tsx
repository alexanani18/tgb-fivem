"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SessionUser {
  id: number;
  username: string;
  role: "ADMIN" | "PARTICIPANT";
}

interface IconProps {
  className?: string;
}

function ArrowLeftIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function MailIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function StarIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2-4.6-4.4 6.3-.9L12 2.8Z" />
    </svg>
  );
}

function ClockIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SendIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function FileIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2h8l4 4v16H6Z" />
      <path d="M14 2v5h5" />
    </svg>
  );
}

function TrashIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V3h8v3" />
      <path d="m19 6-1 15H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function AlertIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.4 3h5.2L21 9.4v5.2L14.6 21H9.4L3 14.6V9.4L9.4 3Z" />
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

function ArchiveIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16v14H4Z" />
      <path d="M2 3h20v4H2Z" />
      <path d="M9 12h6" />
    </svg>
  );
}

function TagIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 13 13 20l-9-9V4h7l9 9Z" />
      <circle cx="8.5" cy="8.5" r="1" />
    </svg>
  );
}

function PaperclipIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 1 1-2.8-2.8l8.9-8.9" />
    </svg>
  );
}

function SettingsIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function RefreshIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6v5h-5" />
      <path d="M19 11a7 7 0 1 0 1 4" />
    </svg>
  );
}

function ForwardIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m14 5 7 7-7 7" />
      <path d="M21 12H3" />
    </svg>
  );
}

function MoreIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

const sidebarItems = [
  {
    label: "Inbox",
    icon: MailIcon,
    active: true,
  },
  {
    label: "Starred",
    icon: StarIcon,
  },
  {
    label: "Snoozed",
    icon: ClockIcon,
  },
  {
    label: "Sent",
    icon: SendIcon,
  },
  {
    label: "Drafts",
    icon: FileIcon,
  },
];

const topActions = [
  {
    label: "Arhivează",
    icon: ArchiveIcon,
  },
  {
    label: "Raportează",
    icon: AlertIcon,
  },
  {
    label: "Șterge",
    icon: TrashIcon,
  },
  {
    label: "Marchează",
    icon: MailIcon,
  },
  {
    label: "Amână",
    icon: ClockIcon,
  },
  {
    label: "Etichete",
    icon: TagIcon,
  },
];

export default function Dashboard() {
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

        const data = await response.json();

        setUser(data.user);
      } catch (error) {
        console.error("Session check failed:", error);
        router.replace("/");
      } finally {
        setIsLoading(false);
      }
    }

    checkSession();
  }, [router]);

  if (isLoading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/img/logged-image.png')",
          }}
        />

        <div className="absolute inset-0 bg-black/80" />

        <div className="relative flex flex-col items-center gap-5">
          <RefreshIcon className="h-10 w-10 animate-spin text-green-500" />

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
          backgroundImage: "url('/img/logged-image.png')",
        }}
      />

      <div className="fixed inset-0 bg-black/55" />

      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,rgba(0,0,0,0.62)_100%)]" />

      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden w-[205px] shrink-0 border-r border-white/10 bg-black/35 px-5 py-6 backdrop-blur-[3px] md:flex md:flex-col">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Înapoi"
          >
            <ArrowLeftIcon className="h-8 w-8" />
          </button>

          <nav className="space-y-2">
            {sidebarItems.map(({ label, icon: Icon, active }) => (
              <button
                key={label}
                type="button"
                className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-sm transition ${
                  active
                    ? "bg-white/10 text-green-400"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-6 w-6 shrink-0" />

                <span>{label}</span>
              </button>
            ))}

            <button
              type="button"
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <span className="flex h-6 w-6 items-center justify-center text-xl">
                ⌄
              </span>

              <span>More</span>
            </button>
          </nav>

          <div className="mt-8 border-t border-white/10 pt-7">
            <div className="mb-5 flex items-center justify-between px-3">
              <span className="text-sm text-zinc-300">Labels</span>

              <button
                type="button"
                className="text-2xl font-light text-zinc-300 transition hover:text-green-400"
                aria-label="Adaugă etichetă"
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <TagIcon className="h-5 w-5" />

              <span>Important</span>
            </button>
          </div>

          <div className="mt-auto border-t border-white/10 pt-5">
            <p className="truncate px-3 text-sm text-zinc-300">
              {user.username}
            </p>

            <p className="mt-1 px-3 text-xs tracking-wider text-green-500 uppercase">
              {user.role}
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-[92px] items-center border-b border-white/15 bg-black/25 px-4 backdrop-blur-[3px] sm:px-7">
            <button
              type="button"
              onClick={() => router.back()}
              className="mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/10 hover:text-white md:hidden"
              aria-label="Înapoi"
            >
              <ArrowLeftIcon className="h-7 w-7" />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              {topActions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/10 hover:text-green-400"
                  aria-label={label}
                >
                  <Icon className="h-6 w-6" />
                </button>
              ))}

              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/10 hover:text-green-400"
                aria-label="Mai multe opțiuni"
              >
                <MoreIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-xs tracking-[0.15em] text-zinc-300 uppercase backdrop-blur transition hover:border-green-500/50 hover:text-green-400"
              >
                {user.username}
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <article className="flex min-h-[calc(100vh-92px)] max-w-[1140px] flex-col px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
              <div className="border-b border-white/15 pb-8">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-xl font-semibold text-zinc-100 sm:text-2xl">
                      De la:
                    </span>

                    <span className="text-xl font-medium text-green-500 sm:text-2xl">
                      anonimus@fplayt.ro
                    </span>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-xl font-semibold text-zinc-100 sm:text-2xl">
                      Subiect:
                    </span>

                    <span className="text-xl font-medium text-green-500 sm:text-2xl">
                      Task
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-b border-white/15 py-7">
                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-green-500 transition hover:bg-green-500/10 hover:text-green-400"
                  aria-label="Adaugă la favorite"
                >
                  <StarIcon className="h-8 w-8" />
                </button>

                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-green-500 transition hover:bg-green-500/10 hover:text-green-400"
                  aria-label="Atașamente"
                >
                  <PaperclipIcon className="h-8 w-8" />
                </button>

                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-green-500 transition hover:bg-green-500/10 hover:text-green-400"
                  aria-label="Setări"
                >
                  <SettingsIcon className="h-8 w-8" />
                </button>

                <button
                  type="button"
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-green-500 transition hover:bg-green-500/10 hover:text-green-400"
                  aria-label="Reîncarcă"
                >
                  <RefreshIcon className="h-8 w-8" />
                </button>
              </div>

              <div className="max-w-[900px] flex-1 py-9 text-lg leading-relaxed text-zinc-100 sm:text-xl sm:leading-relaxed lg:text-[22px]">
                <p>Ai primit 4 fotografii.</p>

                <p className="mt-8">
                  Misiunea ta este simplă: găsește fiecare dintre locațiile din
                  imagini și trimite-mi câte un selfie din fiecare dintre ele,
                  ca dovadă că ai fost acolo.
                </p>

                <p className="mt-8">
                  Nu contează cât durează. Contează doar să le găsești.
                </p>

                <p className="mt-9 font-semibold">
                  <span className="text-green-500">Succes.</span>{" "}
                  <span>Vei avea nevoie.</span>
                </p>
              </div>

              <div className="flex flex-col gap-4 border-t border-white/15 pt-8 sm:flex-row">
                <button
                  type="button"
                  className="group flex min-h-16 items-center justify-center gap-4 rounded-xl border border-white/25 bg-black/35 px-8 text-lg text-green-500 backdrop-blur-md transition hover:border-green-500/60 hover:bg-green-500/10 hover:text-green-400 sm:min-w-[260px]"
                >
                  <RefreshIcon className="h-7 w-7 transition group-hover:-rotate-45" />

                  <span>Răspunde</span>
                </button>

                <button
                  type="button"
                  className="group flex min-h-16 items-center justify-center gap-4 rounded-xl border border-white/25 bg-black/35 px-8 text-lg text-green-500 backdrop-blur-md transition hover:border-green-500/60 hover:bg-green-500/10 hover:text-green-400 sm:min-w-[290px]"
                >
                  <ForwardIcon className="h-7 w-7 transition group-hover:translate-x-1" />

                  <span>Redirecționează</span>
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
