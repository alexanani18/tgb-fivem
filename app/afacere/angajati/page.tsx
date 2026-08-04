"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Search,
} from "lucide-react";

import AppShell from "../../components/AppShell";

type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA";

interface User {
  id: number;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UsersResponse {
  success: boolean;
  message?: string;
  users?: User[];
}

const USERS_PER_PAGE = 20;

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Dată indisponibilă";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function EmployeesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredUsers = users.filter((user) => {
    if (!normalizedSearchTerm) {
      return true;
    }

    return (
      user.username.toLowerCase().includes(normalizedSearchTerm) ||
      user.role.toLowerCase().includes(normalizedSearchTerm)
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / USERS_PER_PAGE),
  );

  const firstUserIndex = (currentPage - 1) * USERS_PER_PAGE;
  const lastUserIndex = firstUserIndex + USERS_PER_PAGE;

  const paginatedUsers = filteredUsers.slice(firstUserIndex, lastUserIndex);

  const loadUsers = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage("");

      const response = await fetch("http://localhost:5000/users", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await response.json()) as UsersResponse;

      if (!response.ok) {
        setUsers([]);
        setCurrentPage(1);
        setErrorMessage(
          data.message || "Utilizatorii nu au putut fi încărcați.",
        );
        return;
      }

      setUsers(data.users ?? []);
      setCurrentPage(1);
    } catch (error) {
      console.error("Load users request error:", error);

      setUsers([]);
      setCurrentPage(1);
      setErrorMessage("Nu s-a putut realiza conexiunea cu serverul.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    setCurrentPage(1);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadUsers]);

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 backdrop-blur-md">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm tracking-[0.2em] text-green-500 uppercase">
                Afacere
              </p>

              <h1 className="mt-3 text-3xl font-bold text-white">Angajați</h1>

              <p className="mt-4 max-w-2xl text-zinc-300">
                Lista tuturor utilizatorilor înregistrați în aplicație.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadUsers(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={isRefreshing ? "animate-spin" : ""}
              />
              Reîncarcă
            </button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatisticCard
              label="Total utilizatori"
              value={filteredUsers.length}
              icon={Users}
            />

            <StatisticCard
              label="Angajați"
              value={users.filter((user) => user.role === "ANGAJAT").length}
              icon={UserRound}
            />

            <StatisticCard
              label="Mafia"
              value={users.filter((user) => user.role === "MAFIA").length}
              icon={Users}
            />

            <StatisticCard
              label="Administratori"
              value={users.filter((user) => user.role === "ADMIN").length}
              icon={ShieldCheck}
            />
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <Search
                size={18}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-500"
              />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Caută după username sau rol..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pr-4 pl-11 text-sm text-white outline-none transition placeholder:text-zinc-500 hover:border-white/20 focus:border-green-500/50"
              />
            </div>

            <p className="text-sm text-zinc-400">
              {filteredUsers.length}{" "}
              {filteredUsers.length === 1
                ? "utilizator găsit"
                : "utilizatori găsiți"}
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            {isLoading ? (
              <div className="flex min-h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-300">
                  <LoaderCircle
                    size={22}
                    className="animate-spin text-green-500"
                  />
                  Se încarcă utilizatorii...
                </div>
              </div>
            ) : errorMessage ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <AlertCircle size={32} className="text-red-400" />

                <p className="mt-4 font-medium text-white">
                  Utilizatorii nu au putut fi încărcați
                </p>

                <p className="mt-2 text-sm text-zinc-400">{errorMessage}</p>

                <button
                  type="button"
                  onClick={() => void loadUsers()}
                  className="mt-5 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
                >
                  Încearcă din nou
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <Users size={34} className="text-zinc-500" />

                <p className="mt-4 font-medium text-white">
                  {searchTerm ? "Nu există rezultate" : "Nu există utilizatori"}
                </p>

                <p className="mt-2 text-sm text-zinc-400">
                  {searchTerm
                    ? "Niciun utilizator nu corespunde căutării."
                    : "Momentan nu există utilizatori înregistrați."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-left">
                        <th className="px-5 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                          Username
                        </th>

                        <th className="px-5 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                          Rol
                        </th>

                        <th className="px-5 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                          Status
                        </th>

                        <th className="px-5 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                          Creat la
                        </th>

                        <th className="px-5 py-4 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                          Actualizat la
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                          Acțiuni
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-white/5 transition last:border-b-0 hover:bg-white/5"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-white">
                                {user.username}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <RoleBadge role={user.role} />
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge isActive={user.isActive} />
                          </td>

                          <td className="px-5 py-4 text-sm text-zinc-300">
                            {formatDate(user.createdAt)}
                          </td>

                          <td className="px-5 py-4 text-sm text-zinc-300">
                            {formatDate(user.updatedAt)}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex min-h-8 items-center justify-end">
                              {/* Acțiunile vor fi adăugate aici */}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-400">
                    Se afișează{" "}
                    <span className="font-medium text-white">
                      {firstUserIndex + 1}
                    </span>
                    {" - "}
                    <span className="font-medium text-white">
                      {Math.min(lastUserIndex, users.length)}
                    </span>
                    {" din "}
                    <span className="font-medium text-white">
                      {users.length}
                    </span>
                    {" utilizatori"}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) => Math.max(1, page - 1))
                      }
                      disabled={currentPage === 1}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Înapoi
                    </button>

                    <span className="px-3 text-sm text-zinc-400">
                      Pagina{" "}
                      <span className="font-medium text-white">
                        {currentPage}
                      </span>
                      {" din "}
                      <span className="font-medium text-white">
                        {totalPages}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Următoarea
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

interface StatisticCardProps {
  label: string;
  value: number;
  icon: typeof Users;
}

function StatisticCard({ label, value, icon: Icon }: StatisticCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>

          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

interface RoleBadgeProps {
  role: UserRole;
}

function RoleBadge({ role }: RoleBadgeProps) {
  const roleClasses: Record<UserRole, string> = {
    ANGAJAT: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    MAFIA: "border-red-500/20 bg-red-500/10 text-red-300",
    ADMIN: "border-purple-500/20 bg-purple-500/10 text-purple-300",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${roleClasses[role]}`}
    >
      {role}
    </span>
  );
}

interface StatusBadgeProps {
  isActive: boolean;
}

function StatusBadge({ isActive }: StatusBadgeProps) {
  return (
    <span
      className={
        isActive
          ? "inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300"
          : "inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300"
      }
    >
      <span
        className={
          isActive
            ? "h-1.5 w-1.5 rounded-full bg-green-400"
            : "h-1.5 w-1.5 rounded-full bg-red-400"
        }
      />

      {isActive ? "Activ" : "Inactiv"}
    </span>
  );
}
