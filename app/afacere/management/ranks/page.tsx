"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  CircleDollarSign,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import AppShell from "../../../components/AppShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type SalaryType = "PUBLIC" | "CONFIDENTIAL";

interface Rank {
  id: number;
  name: string;
  salary: number;
  salary_type: SalaryType;
  sort_order: number;
  users_count: number;
}

interface SessionUser {
  id: number;
  username: string;
  role: string;
}

interface SessionResponse {
  success: boolean;
  user?: SessionUser;
  message?: string;
}

interface RanksResponse {
  success: boolean;
  ranks?: Rank[];
  rank?: Rank;
  message?: string;
}

interface RankFormState {
  name: string;
  salary: string;
  salary_type: SalaryType;
  sort_order: string;
}

const EMPTY_FORM: RankFormState = {
  name: "",
  salary: "",
  salary_type: "PUBLIC",
  sort_order: "",
};

function formatSalary(value: number) {
  return new Intl.NumberFormat("ro-RO").format(value);
}

export default function ManagementRanksPage() {
  const router = useRouter();

  const [ranks, setRanks] = useState<Rank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingRankId, setDeletingRankId] = useState<number | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRankId, setEditingRankId] = useState<number | null>(null);
  const [form, setForm] = useState<RankFormState>(EMPTY_FORM);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sortedRanks = useMemo(() => {
    return [...ranks].sort((firstRank, secondRank) => {
      if (firstRank.sort_order !== secondRank.sort_order) {
        return firstRank.sort_order - secondRank.sort_order;
      }

      return firstRank.name.localeCompare(secondRank.name, "ro");
    });
  }, [ranks]);

  const totalSalary = useMemo(() => {
    return ranks.reduce((total, rank) => {
      if (rank.salary_type === "CONFIDENTIAL") {
        return total;
      }

      return total + Number(rank.salary);
    }, 0);
  }, [ranks]);

  const totalUsers = useMemo(() => {
    return ranks.reduce((total, rank) => total + Number(rank.users_count), 0);
  }, [ranks]);

  const highestRank = sortedRanks[0] ?? null;

  const clearMessages = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  const loadRanks = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(`${API_URL}/ranks/admin`, {
        method: "GET",
        credentials: "include",
      });

      const data = (await response.json()) as RanksResponse;

      if (response.status === 401) {
        router.replace("/");
        return;
      }

      if (response.status === 403) {
        router.replace("/afacere");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Rank-urile nu au putut fi încărcate.");
      }

      setRanks(data.ranks ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la încărcarea rank-urilor.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initializePage = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        const data = (await response.json()) as SessionResponse;

        if (!response.ok || !data.success || !data.user) {
          router.replace("/");
          return;
        }

        if (data.user.role !== "ADMIN") {
          router.replace("/afacere");
          return;
        }

        await loadRanks();
      } catch (error) {
        console.error("Eroare la verificarea sesiunii:", error);
        router.replace("/");
      }
    };

    void initializePage();
  }, [loadRanks, router]);

  const openCreateForm = () => {
    clearMessages();
    setEditingRankId(null);

    const nextSortOrder =
      ranks.length === 0
        ? 1
        : Math.max(...ranks.map((rank) => rank.sort_order)) + 1;

    setForm({
      name: "",
      salary: "",
      salary_type: "PUBLIC",
      sort_order: String(nextSortOrder),
    });

    setIsFormOpen(true);
  };

  const openEditForm = (rank: Rank) => {
    clearMessages();
    setEditingRankId(rank.id);

    setForm({
      name: rank.name,
      salary: rank.salary_type === "CONFIDENTIAL" ? "" : String(rank.salary),
      salary_type: rank.salary_type,
      sort_order: String(rank.sort_order),
    });

    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setEditingRankId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();

    const name = form.name.trim();
    const salaryType = form.salary_type;
    const salary = salaryType === "CONFIDENTIAL" ? 0 : Number(form.salary);
    const sortOrder = Number(form.sort_order);

    if (!name) {
      setErrorMessage("Completează numele rank-ului.");
      return;
    }

    if (salaryType === "PUBLIC" && (!Number.isInteger(salary) || salary <= 0)) {
      setErrorMessage(
        "Pentru un salariu public, valoarea trebuie să fie un număr întreg mai mare decât 0.",
      );
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 1) {
      setErrorMessage(
        "Ordinea trebuie să fie un număr întreg mai mare decât 0.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const isEditing = editingRankId !== null;

      const endpoint = isEditing
        ? `${API_URL}/ranks/admin/${editingRankId}`
        : `${API_URL}/ranks/admin`;

      const response = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          salary,
          salary_type: salaryType,
          sort_order: sortOrder,
        }),
      });

      const data = (await response.json()) as RanksResponse;

      if (response.status === 401) {
        router.replace("/");
        return;
      }

      if (response.status === 403) {
        router.replace("/afacere");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ??
            (isEditing
              ? "Rank-ul nu a putut fi modificat."
              : "Rank-ul nu a putut fi adăugat."),
        );
      }

      setSuccessMessage(
        data.message ??
          (isEditing
            ? "Rank-ul a fost modificat cu succes."
            : "Rank-ul a fost adăugat cu succes."),
      );

      setIsFormOpen(false);
      setEditingRankId(null);
      setForm(EMPTY_FORM);

      await loadRanks();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la salvarea rank-ului.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (rank: Rank) => {
    clearMessages();

    if (rank.users_count > 0) {
      setErrorMessage(
        `Rank-ul „${rank.name}” nu poate fi șters deoarece este atribuit ${
          rank.users_count === 1
            ? "unui utilizator"
            : `${rank.users_count} utilizatori`
        }.`,
      );
      return;
    }

    const confirmed = window.confirm(
      `Sigur vrei să ștergi rank-ul „${rank.name}”?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingRankId(rank.id);

      const response = await fetch(`${API_URL}/ranks/admin/${rank.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = (await response.json()) as RanksResponse;

      if (response.status === 401) {
        router.replace("/");
        return;
      }

      if (response.status === 403) {
        router.replace("/afacere");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Rank-ul nu a putut fi șters.");
      }

      setSuccessMessage(data.message ?? "Rank-ul a fost șters cu succes.");

      setRanks((currentRanks) =>
        currentRanks.filter((currentRank) => currentRank.id !== rank.id),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la ștergerea rank-ului.",
      );
    } finally {
      setDeletingRankId(null);
    }
  };

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <main className="min-h-screen w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1500px]">
          <header className="mb-6 rounded-2xl border border-white/10 bg-black/70 p-5 shadow-2xl backdrop-blur-md sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-emerald-400 uppercase">
                  Management tabele
                </p>

                <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                  Management rank-uri
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Administrează rank-urile, salariile și ordinea în care acestea
                  sunt afișate în sistem.
                </p>
              </div>

              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400"
              >
                <Plus size={18} />
                Adaugă rank
              </button>
            </div>
          </header>

          {successMessage && (
            <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200 backdrop-blur-md">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-200 backdrop-blur-md">
              {errorMessage}
            </div>
          )}

          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/90 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Total rank-uri
                  </p>

                  <p className="mt-3 text-2xl font-bold text-white">
                    {ranks.length}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Rank-uri înregistrate
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
                  <ShieldCheck size={22} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950/90 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Salarii configurate
                  </p>

                  <p className="mt-3 text-2xl font-bold text-white">
                    {formatSalary(totalSalary)} $
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Total salarii pe oră
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
                  <CircleDollarSign size={22} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950/90 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Utilizatori
                  </p>

                  <p className="mt-3 text-2xl font-bold text-white">
                    {totalUsers}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Utilizatori cu rank
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
                  <Users size={22} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950/90 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    Primul în ordine
                  </p>

                  <p className="mt-3 truncate text-base font-bold text-white">
                    {highestRank?.name ?? "-"}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {highestRank
                      ? highestRank.salary_type === "CONFIDENTIAL"
                        ? "Salariu confidențial"
                        : `${formatSalary(highestRank.salary)} $/oră`
                      : "Niciun rank configurat"}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
                  <BadgeDollarSign size={22} />
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-white">
                    Rank-uri existente
                  </h2>

                  <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                    {ranks.length}
                  </span>
                </div>

                <p className="mt-1 text-xs text-zinc-500">
                  Rank-urile sunt afișate conform ordinii configurate.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <LoaderCircle
                    size={21}
                    className="animate-spin text-emerald-400"
                  />
                  Se încarcă rank-urile...
                </div>
              </div>
            ) : sortedRanks.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <div className="rounded-2xl border border-zinc-800 bg-black/50 p-4">
                  <BadgeDollarSign size={36} className="text-zinc-600" />
                </div>

                <h3 className="mt-4 font-semibold text-white">
                  Nu există rank-uri
                </h3>

                <p className="mt-2 max-w-md text-sm text-zinc-500">
                  Apasă pe „Adaugă rank” pentru a crea primul rank.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/60">
                      <th className="w-28 px-6 py-4 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Ordine
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Rank
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Salariu/oră
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Utilizatori
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Acțiuni
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedRanks.map((rank) => {
                      const isDeleting = deletingRankId === rank.id;

                      const canDelete = rank.users_count === 0;

                      return (
                        <tr
                          key={rank.id}
                          className="border-b border-white/[0.07] transition last:border-b-0 hover:bg-white/[0.035]"
                        >
                          <td className="px-6 py-5">
                            <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 text-sm font-bold text-emerald-300">
                              {rank.sort_order}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <div className="font-semibold text-white">
                              {rank.name}
                            </div>

                            <div className="mt-1 text-xs text-zinc-600">
                              ID rank: {rank.id}
                            </div>
                          </td>

                          <td className="px-6 py-5">
                            <div className="inline-flex items-center gap-2 font-semibold text-emerald-300">
                              <CircleDollarSign size={18} />
                              {rank.salary_type === "CONFIDENTIAL"
                                ? "Confidențial"
                                : `${formatSalary(rank.salary)} $/oră`}
                            </div>
                          </td>

                          <td className="px-6 py-5">
                            <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300">
                              <Users size={18} className="text-zinc-500" />

                              {rank.users_count}
                            </div>
                          </td>

                          <td className="px-6 py-5">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditForm(rank)}
                                disabled={
                                  isSubmitting || deletingRankId !== null
                                }
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Pencil size={15} />
                                Editează
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(rank)}
                                disabled={
                                  !canDelete ||
                                  isDeleting ||
                                  isSubmitting ||
                                  (deletingRankId !== null && !isDeleting)
                                }
                                title={
                                  canDelete
                                    ? "Șterge rank-ul"
                                    : "Rank-ul este atribuit unor utilizatori și nu poate fi șters"
                                }
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-xs font-semibold text-red-300 transition hover:border-red-500/50 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                {isDeleting ? (
                                  <LoaderCircle
                                    size={15}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                                Șterge
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-emerald-400 uppercase">
                  Management rank-uri
                </p>

                <h2 className="mt-2 text-xl font-bold text-white">
                  {editingRankId !== null
                    ? "Editează rank-ul"
                    : "Adaugă rank nou"}
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Completează informațiile de mai jos și salvează modificările.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={isSubmitting}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Închide formularul"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-5 px-5 py-6 sm:px-6">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                    Nume rank
                  </span>

                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        name: event.target.value,
                      }))
                    }
                    maxLength={100}
                    placeholder="Ex: Blackfold Manager"
                    disabled={isSubmitting}
                    autoFocus
                    className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                      Tip salariu
                    </span>

                    <select
                      value={form.salary_type}
                      onChange={(event) => {
                        const salaryType = event.target.value as SalaryType;

                        setForm((currentForm) => ({
                          ...currentForm,
                          salary_type: salaryType,
                          salary:
                            salaryType === "CONFIDENTIAL"
                              ? ""
                              : currentForm.salary,
                        }));
                      }}
                      disabled={isSubmitting}
                      className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="PUBLIC">Public</option>
                      <option value="CONFIDENTIAL">Confidențial</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                      Salariu/oră
                    </span>

                    <input
                      type="number"
                      value={form.salary}
                      onChange={(event) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          salary: event.target.value,
                        }))
                      }
                      min={1}
                      step={1}
                      placeholder={
                        form.salary_type === "CONFIDENTIAL"
                          ? "Salariu confidențial"
                          : "Ex: 10000"
                      }
                      disabled={
                        isSubmitting || form.salary_type === "CONFIDENTIAL"
                      }
                      className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                      Ordine
                    </span>

                    <input
                      type="number"
                      value={form.sort_order}
                      onChange={(event) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          sort_order: event.target.value,
                        }))
                      }
                      min={1}
                      step={1}
                      placeholder="Ex: 1"
                      disabled={isSubmitting}
                      className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <p className="text-sm leading-6 text-zinc-400">
                    Ordinea stabilește poziția rank-ului în liste. Rank-ul cu
                    ordinea{" "}
                    <span className="font-semibold text-emerald-300">1</span> va
                    fi afișat primul. Pentru salariile confidențiale, valoarea
                    nu este afișată și nu este inclusă în totalul salariilor.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-black/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSubmitting}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anulează
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}

                  {editingRankId !== null
                    ? "Salvează modificările"
                    : "Adaugă rank"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  );
}
