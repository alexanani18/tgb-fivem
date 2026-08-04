"use client";

import Image from "next/image";
import { ArrowLeft, FileText } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";

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
  contractCreationBlocked: boolean;
  rejectedByUserId: number | null;
  rejectedByName: string | null;
  signedAt: string | null;
  approvedByUserId: number | null;
  approvedByName: string | null;
  adminSignaturePath: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContractResponse {
  success: boolean;
  contract: ContractData;
  message?: string;
}

interface ContractActionResponse {
  success: boolean;
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
    month: "long",
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

    default:
      return "border-white/10 bg-white/5 text-zinc-300";
  }
}

export default function AdminContractDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [contract, setContract] = useState<ContractData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const loadContract = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(`${API_URL}/contracts/admin/${params.id}`, {
        method: "GET",
        credentials: "include",
      });

      const data = (await response.json()) as ContractResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Contractul nu a putut fi încărcat.");
      }

      setContract(data.contract);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare necunoscută.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContract();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadContract]);

  async function handleApproveContract() {
    try {
      setIsApproving(true);
      setErrorMessage("");

      const response = await fetch(
        `${API_URL}/contracts/admin/${params.id}/approve`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = (await response.json()) as ContractActionResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Contractul nu a putut fi aprobat.");
      }

      await loadContract();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la aprobarea contractului.",
      );
    } finally {
      setIsApproving(false);
    }
  }

  async function handleRejectContract() {
    try {
      setIsRejecting(true);
      setErrorMessage("");

      const response = await fetch(
        `${API_URL}/contracts/admin/${params.id}/reject`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = (await response.json()) as ContractActionResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Contractul nu a putut fi respins.");
      }

      await loadContract();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la respingerea contractului.",
      );
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="mx-auto max-w-6xl">
          <button
            type="button"
            onClick={() => router.push("/afacere/contracte")}
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={17} />
            Înapoi la contracte
          </button>

          {isLoading && (
            <div className="rounded-2xl border border-white/10 bg-black/75 p-8 backdrop-blur-md">
              <p className="text-sm text-zinc-300">Se încarcă contractul...</p>
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 backdrop-blur-md">
              <p className="text-sm font-medium text-red-300">{errorMessage}</p>
            </div>
          )}

          {!isLoading && !errorMessage && contract && (
            <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-black/80 shadow-2xl backdrop-blur-md">
              <div className="border-b border-white/10 px-8 py-7">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  <div>
                    <p className="text-sm font-semibold tracking-[0.25em] text-amber-400 uppercase">
                      The Gentleman Blackfold
                    </p>

                    <h1 className="mt-3 text-3xl font-bold text-white">
                      Contract de angajare
                    </h1>

                    <p className="mt-3 text-sm text-zinc-400">
                      Contract #{contract.id} — utilizator{" "}
                      <span className="font-semibold text-white">
                        {contract.username}
                      </span>
                    </p>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-semibold ${getStatusClasses(
                      contract.status,
                    )}`}
                  >
                    {getStatusLabel(contract.status)}
                  </span>
                </div>
              </div>

              <div className="p-8">
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["Nume", contract.lastName],
                    ["Prenume", contract.firstName],
                    ["Vârstă", String(contract.age)],
                    ["CNP / ID joc", contract.gameId],
                    ["Serie CI", contract.ciSeries],
                    ["Număr telefon", contract.phoneNumber],
                    ["Luni pe oraș", String(contract.cityHours)],
                    ["Data semnării", formatDate(contract.signedAt)],
                    ["Username", contract.username],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/10 bg-white/5 p-5"
                    >
                      <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                        {label}
                      </p>

                      <p className="mt-2 font-medium text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-amber-400" />

                      <h2 className="text-lg font-semibold text-white">
                        Poză buletin
                      </h2>
                    </div>

                    <div className="relative mt-5 min-h-80 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                      <Image
                        src={`${API_URL}${contract.identityImagePath}`}
                        alt="Poză buletin"
                        fill
                        unoptimized
                        className="object-contain p-4"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-black/30 p-6">
                    <p className="text-xs font-semibold tracking-[0.15em] text-zinc-500 uppercase">
                      Semnătura angajatului
                    </p>

                    <div className="flex min-h-80 flex-col items-center justify-center text-center">
                      <p
                        className="text-4xl text-amber-300 sm:text-5xl"
                        style={{
                          fontFamily: "cursive",
                        }}
                      >
                        {contract.employeeSignatureName ??
                          `${contract.lastName} ${contract.firstName}`}
                      </p>

                      <div className="mt-8 h-px w-full max-w-sm bg-white/15" />

                      <p className="mt-3 text-sm text-zinc-400">
                        {contract.lastName} {contract.firstName}
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        Semnat la {formatDate(contract.signedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {contract.status === "APPROVED" && (
                  <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
                    <p className="text-xs font-semibold tracking-[0.15em] text-emerald-300 uppercase">
                      Aprobare contract
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                          Aprobat de
                        </p>

                        <p className="mt-2 font-medium text-white">
                          {contract.approvedByName ??
                            "Administrator necunoscut"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                          Data aprobării
                        </p>

                        <p className="mt-2 font-medium text-white">
                          {formatDate(contract.approvedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {contract.status === "REJECTED" && (
                  <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
                    <p className="text-xs font-semibold tracking-[0.15em] text-red-300 uppercase">
                      Respingere contract
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                          Respins de
                        </p>

                        <p className="mt-2 font-medium text-white">
                          {contract.rejectedByName ??
                            "Administrator necunoscut"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                          Data respingerii
                        </p>

                        <p className="mt-2 font-medium text-white">
                          {formatDate(contract.rejectedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
                  <p className="text-sm leading-7 text-zinc-300">
                    Utilizatorul confirmă că informațiile furnizate sunt
                    corecte, că a citit regulamentul intern și că acceptă
                    condițiile contractului de angajare.
                  </p>
                </div>

                {contract.status === "PENDING_REVIEW" && (
                  <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => void handleRejectContract()}
                      disabled={isApproving || isRejecting}
                      className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRejecting ? "Se respinge..." : "Respinge contractul"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleApproveContract()}
                      disabled={isApproving || isRejecting}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isApproving ? "Se aprobă..." : "Aprobă contractul"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
