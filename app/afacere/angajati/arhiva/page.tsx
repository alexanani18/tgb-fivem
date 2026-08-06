"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Archive,
  LoaderCircle,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import AppShell from "../../../components/AppShell";

type EmployeeStatus = "ACTIV" | "CONCEDIU" | "DEMISIONAT";

type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "GUEST" | "DEV";

interface ArchivedUser {
  id: number;

  firstName: string;
  lastName: string;

  iban: string | number;

  phoneNumber: string;
  ciSeries: string;
  cityHours: string | number;

  rank: string;

  status: EmployeeStatus | null;

  meetingAttendance: boolean;
  hasUniform: boolean;
  hasCar: boolean;

  observations: string;
  discordId: string;

  createdAt: string;

  websiteRole: UserRole;
  isActive: boolean;
}

interface ArchiveResponse {
  success: boolean;
  message?: string;
  users?: ArchivedUser[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const USERS_PER_PAGE = 20;

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Dată indisponibilă";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

export default function EmployeesArchivePage() {
  const [users, setUsers] = useState<ArchivedUser[]>([]);

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

    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();

    return (
      fullName.includes(normalizedSearchTerm) ||
      String(user.iban).toLowerCase().includes(normalizedSearchTerm) ||
      user.phoneNumber.toLowerCase().includes(normalizedSearchTerm) ||
      user.ciSeries.toLowerCase().includes(normalizedSearchTerm) ||
      String(user.cityHours).toLowerCase().includes(normalizedSearchTerm) ||
      user.rank.toLowerCase().includes(normalizedSearchTerm) ||
      user.observations.toLowerCase().includes(normalizedSearchTerm) ||
      user.discordId.toLowerCase().includes(normalizedSearchTerm) ||
      user.websiteRole.toLowerCase().includes(normalizedSearchTerm) ||
      (user.status ?? "").toLowerCase().includes(normalizedSearchTerm) ||
      (!user.isActive ? "dezactivat" : "").includes(normalizedSearchTerm)
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / USERS_PER_PAGE),
  );

  const firstUserIndex = (currentPage - 1) * USERS_PER_PAGE;
  const lastUserIndex = firstUserIndex + USERS_PER_PAGE;

  const paginatedUsers = filteredUsers.slice(firstUserIndex, lastUserIndex);

  const loadArchivedUsers = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage("");

      const response = await fetch(`${API_URL}/users/archive`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await response.json()) as ArchiveResponse;

      if (!response.ok || !data.success) {
        setUsers([]);
        setCurrentPage(1);

        setErrorMessage(data.message || "Arhiva nu a putut fi încărcată.");

        return;
      }

      setUsers(data.users ?? []);
      setCurrentPage(1);
    } catch (error) {
      console.error("Load archived users request error:", error);

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
      void loadArchivedUsers();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadArchivedUsers]);

  useEffect(() => {
    if (currentPage <= totalPages) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentPage(totalPages);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentPage, totalPages]);

  const guestCount = users.filter(
    (user) => user.websiteRole === "GUEST",
  ).length;

  const resignedCount = users.filter(
    (user) => user.status === "DEMISIONAT",
  ).length;

  const disabledCount = users.filter((user) => !user.isActive).length;

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 backdrop-blur-md">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm tracking-[0.2em] text-[#B8904D] uppercase">
                Control Panel
              </p>

              <h1 className="mt-3 text-3xl font-bold text-white">
                Arhivă angajați
              </h1>

              <p className="mt-4 max-w-2xl text-zinc-300">
                Lista utilizatorilor GUEST, a angajaților demisionați și a
                conturilor dezactivate.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadArchivedUsers(true)}
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
              label="Total în arhivă"
              value={users.length}
              icon="archive"
            />

            <StatisticCard label="GUEST" value={guestCount} icon="users" />

            <StatisticCard
              label="Demisionați"
              value={resignedCount}
              icon="users"
            />

            <StatisticCard
              label="Dezactivați"
              value={disabledCount}
              icon="users"
            />
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-xl">
              <Search
                size={18}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-500"
              />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Caută după nume, IBAN, telefon, tag sau Discord..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pr-4 pl-11 text-sm text-white outline-none transition placeholder:text-zinc-500 hover:border-white/20 focus:border-[#B8904D]/60"
              />
            </div>

            <p className="text-sm text-zinc-400">
              {filteredUsers.length}{" "}
              {filteredUsers.length === 1
                ? "persoană găsită"
                : "persoane găsite"}
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            {isLoading ? (
              <div className="flex min-h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-300">
                  <LoaderCircle
                    size={22}
                    className="animate-spin text-[#B8904D]"
                  />
                  Se încarcă arhiva...
                </div>
              </div>
            ) : errorMessage ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <AlertCircle size={32} className="text-red-400" />

                <p className="mt-4 font-medium text-white">
                  Arhiva nu a putut fi încărcată
                </p>

                <p className="mt-2 text-sm text-zinc-400">{errorMessage}</p>

                <button
                  type="button"
                  onClick={() => void loadArchivedUsers()}
                  className="mt-5 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
                >
                  Încearcă din nou
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <Archive size={36} className="text-zinc-500" />

                <p className="mt-4 font-medium text-white">
                  {searchTerm ? "Nu există rezultate" : "Arhiva este goală"}
                </p>

                <p className="mt-2 text-sm text-zinc-400">
                  {searchTerm
                    ? "Nicio persoană nu corespunde căutării."
                    : "Momentan nu există utilizatori arhivați."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1450px] border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <TableHeader>Nume Prenume</TableHeader>
                        <TableHeader>Tag-uri</TableHeader>
                        <TableHeader>IBAN</TableHeader>
                        <TableHeader>Nr. Telefon</TableHeader>
                        <TableHeader>Serie CI</TableHeader>
                        <TableHeader>Luni</TableHeader>
                        <TableHeader>Grad</TableHeader>
                        <TableHeader>Data creării</TableHeader>
                        <TableHeader>Observații</TableHeader>
                        <TableHeader>ID Discord</TableHeader>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-white/5 transition last:border-b-0 hover:bg-white/5"
                        >
                          <td className="px-4 py-4">
                            <Link
                              href={`/afacere/angajati/${user.id}?from=archive`}
                              className="font-medium whitespace-nowrap text-[#D8B979] transition hover:text-[#F0D49A] hover:underline"
                            >
                              {displayValue(user.firstName)} {user.lastName}
                            </Link>
                          </td>

                          <td className="px-4 py-4">
                            <ArchiveTags user={user} />
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {displayValue(user.iban)}
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {displayValue(user.phoneNumber)}
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {displayValue(user.ciSeries)}
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {displayValue(user.cityHours)}
                          </td>

                          <td className="px-4 py-4">
                            <RankBadge rank={user.rank} />
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {formatDate(user.createdAt)}
                          </td>

                          <td
                            className="max-w-[260px] px-4 py-4 text-sm text-zinc-300"
                            title={user.observations || undefined}
                          >
                            <span className="block truncate">
                              {displayValue(user.observations)}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-sm whitespace-nowrap text-zinc-300">
                            {displayValue(user.discordId)}
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
                      {Math.min(lastUserIndex, filteredUsers.length)}
                    </span>
                    {" din "}
                    <span className="font-medium text-white">
                      {filteredUsers.length}
                    </span>
                    {" persoane"}
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

interface ArchiveTagsProps {
  user: ArchivedUser;
}

function ArchiveTags({ user }: ArchiveTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {user.websiteRole === "GUEST" ? (
        <span className="inline-flex rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold whitespace-nowrap text-amber-300">
          GUEST
        </span>
      ) : null}

      {user.status === "DEMISIONAT" ? (
        <span className="inline-flex rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold whitespace-nowrap text-red-300">
          DEMISIONAT
        </span>
      ) : null}

      {!user.isActive ? (
        <span className="inline-flex rounded-full border border-zinc-500/30 bg-zinc-500/10 px-3 py-1 text-xs font-semibold whitespace-nowrap text-zinc-300">
          DEZACTIVAT
        </span>
      ) : null}
    </div>
  );
}

interface StatisticCardProps {
  label: string;
  value: number;
  icon: "archive" | "users";
}

function StatisticCard({ label, value, icon }: StatisticCardProps) {
  const Icon = icon === "archive" ? Archive : Users;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>

          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B8904D]/10 text-[#B8904D]">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

interface TableHeaderProps {
  children: React.ReactNode;
}

function TableHeader({ children }: TableHeaderProps) {
  return (
    <th className="px-4 py-4 text-left text-xs font-semibold tracking-wider whitespace-nowrap text-zinc-400 uppercase">
      {children}
    </th>
  );
}

interface RankBadgeProps {
  rank: string;
}

function RankBadge({ rank }: RankBadgeProps) {
  if (!rank || rank === "—") {
    return <span className="text-sm text-zinc-500">—</span>;
  }

  return (
    <span className="inline-flex rounded-full border border-[#B8904D]/25 bg-[#B8904D]/10 px-3 py-1 text-xs font-semibold whitespace-nowrap text-[#D8B979]">
      {rank}
    </span>
  );
}
