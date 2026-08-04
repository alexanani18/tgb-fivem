"use client";

import {
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  Search,
  ShieldX,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "../../components/AppShell";

type ContractStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED";

interface ContractData {
  id: number;
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  age: number;
  gameId: string;
  ciSeries: string;
  phoneNumber: string;
  cityHours: number;
  identityImagePath: string;
  acceptedRules: boolean;
  employeeSignatureName: string | null;
  status: ContractStatus;
  rejectionReason: string | null;
  contractCreationBlocked: boolean;
  signedAt: string | null;
  approvedByUserId: number | null;
  approvedByName: string | null;
  adminSignaturePath: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContractsResponse {
  success: boolean;
  contracts: ContractData[];
  message?: string;
}

const API_URL = "http://localhost:5000";

function formatDate(dateValue: string | null): string {
  if (!dateValue) {
    return "—";
  }

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

function getStatusLabel(status: ContractStatus): string {
  switch (status) {
    case "PENDING_REVIEW":
      return "În verificare";

    case "APPROVED":
      return "Aprobat";

    case "REJECTED":
      return "Respins";

    case "BLOCKED":
      return "Blocat";

    case "DRAFT":
      return "Ciornă";

    default:
      return status;
  }
}

function getStatusClasses(status: ContractStatus): string {
  switch (status) {
    case "PENDING_REVIEW":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";

    case "APPROVED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "REJECTED":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    case "BLOCKED":
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";

    case "DRAFT":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    default:
      return "border-white/10 bg-white/5 text-zinc-300";
  }
}

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  async function loadContracts() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(`${API_URL}/contracts/admin`, {
        method: "GET",
        credentials: "include",
      });

      const data = (await response.json()) as ContractsResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Contractele nu au putut fi încărcate.",
        );
      }

      setContracts(data.contracts);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare necunoscută.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContracts();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const filteredContracts = useMemo(() => {
    const normalizedSearchValue = searchValue.trim().toLowerCase();

    if (!normalizedSearchValue) {
      return contracts;
    }

    return contracts.filter((contract) => {
      const fullName =
        `${contract.lastName} ${contract.firstName}`.toLowerCase();

      return (
        contract.username.toLowerCase().includes(normalizedSearchValue) ||
        fullName.includes(normalizedSearchValue) ||
        contract.gameId.toLowerCase().includes(normalizedSearchValue) ||
        getStatusLabel(contract.status)
          .toLowerCase()
          .includes(normalizedSearchValue)
      );
    });
  }, [contracts, searchValue]);

  const pendingContractsCount = contracts.filter(
    (contract) => contract.status === "PENDING_REVIEW",
  ).length;

  const approvedContractsCount = contracts.filter(
    (contract) => contract.status === "APPROVED",
  ).length;

  const rejectedContractsCount = contracts.filter(
    (contract) => contract.status === "REJECTED",
  ).length;

  const blockedContractsCount = contracts.filter(
    (contract) => contract.status === "BLOCKED",
  ).length;

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="rounded-2xl border border-white/10 bg-black/75 p-8 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div>
              <p className="text-sm font-semibold tracking-[0.25em] text-emerald-400 uppercase">
                Control Panel
              </p>

              <h1 className="mt-3 text-3xl font-bold text-white">Contracte</h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Verifică toate contractele trimise și gestionează cererile de
                angajare.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadContracts()}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={isLoading ? "animate-spin" : ""}
              />
              Reîncarcă
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-amber-500/20 bg-black/40 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">În verificare</p>

                  <p className="mt-2 text-3xl font-bold text-white">
                    {pendingContractsCount}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400">
                  <Clock3 size={24} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-black/40 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Aprobate</p>

                  <p className="mt-2 text-3xl font-bold text-white">
                    {approvedContractsCount}
                  </p>
                </div>

                <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
                  <CheckCircle2 size={24} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-black/40 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Respinse</p>

                  <p className="mt-2 text-3xl font-bold text-white">
                    {rejectedContractsCount}
                  </p>
                </div>

                <div className="rounded-xl bg-red-500/10 p-3 text-red-400">
                  <XCircle size={24} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-500/20 bg-black/40 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Blocate</p>

                  <p className="mt-2 text-3xl font-bold text-white">
                    {blockedContractsCount}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-500/10 p-3 text-zinc-300">
                  <ShieldX size={24} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="relative w-full max-w-md">
              <Search
                size={18}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-500"
              />

              <input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Caută după username, nume, ID sau status..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pr-4 pl-11 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10"
              />
            </div>

            <p className="text-sm text-zinc-400">
              {filteredContracts.length} contracte găsite
            </p>
          </div>

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-medium text-red-300">{errorMessage}</p>
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-240 border-collapse">
                <thead className="bg-white/5">
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-4 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                      Utilizator
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                      Nume complet
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                      ID joc
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                      Status
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                      Trimis la
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                      Acțiuni
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-sm text-zinc-400"
                      >
                        Se încarcă lista contractelor...
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    !errorMessage &&
                    filteredContracts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center">
                          <FileText
                            size={34}
                            className="mx-auto text-zinc-600"
                          />

                          <p className="mt-3 text-sm font-medium text-zinc-300">
                            Nu există contracte.
                          </p>
                        </td>
                      </tr>
                    )}

                  {!isLoading &&
                    filteredContracts.map((contract) => (
                      <tr
                        key={contract.id}
                        className="border-b border-white/5 bg-black/20 transition last:border-b-0 hover:bg-white/5"
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium text-white">
                            {contract.username}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-zinc-300">
                          {contract.lastName} {contract.firstName}
                        </td>

                        <td className="px-5 py-4 text-sm text-zinc-300">
                          {contract.gameId}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              contract.status,
                            )}`}
                          >
                            {getStatusLabel(contract.status)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-zinc-400">
                          {formatDate(contract.signedAt)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/afacere/contracte/${contract.id}`)
                            }
                            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
                          >
                            Vezi contractul
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
