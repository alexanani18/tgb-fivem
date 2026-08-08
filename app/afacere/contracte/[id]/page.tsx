"use client";

import Image from "next/image";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Eye,
  FilePlus2,
  FileText,
  RefreshCw,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import AppShell from "../../../components/AppShell";

type ContractStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED";

type ContractType = "UNLIMITED" | "FIXED";
type ScheduleMode = "DEFAULT" | "CUSTOM";

interface Rank {
  id: number;
  name: string;
  salary: number;
  salary_type: "PUBLIC" | "CONFIDENTIAL";
  sort_order: number;
  users_count: number;
}

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
  workSchedule: string | null;
  contractType: ContractType | null;
  contractEndDate: string | null;
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

interface RanksResponse {
  success: boolean;
  ranks?: Rank[];
  message?: string;
}

interface GeneratedContractDocument {
  documentNumber: string;
  currentVersion: number;
  pngPath: string;
  pdfPath: string;
  generatedAt: string;
}

interface GeneratedContractResponse {
  success: boolean;
  document: GeneratedContractDocument | null;
  message?: string;
}

interface GenerateContractResponse {
  success: boolean;
  message?: string;
  documentNumber?: string;
  versionNumber?: number;
  pngPath?: string;
  pdfPath?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

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

  const [ranks, setRanks] = useState<Rank[]>([]);
  const [isLoadingRanks, setIsLoadingRanks] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isRegenerationModalOpen, setIsRegenerationModalOpen] = useState(false);
  const [selectedRankId, setSelectedRankId] = useState("");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("DEFAULT");
  const [customWorkSchedule, setCustomWorkSchedule] = useState("");
  const [contractType, setContractType] = useState<ContractType>("UNLIMITED");
  const [contractEndDate, setContractEndDate] = useState("");
  const [generatedDocument, setGeneratedDocument] =
    useState<GeneratedContractDocument | null>(null);

  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);

  const [documentErrorMessage, setDocumentErrorMessage] = useState("");
  const [documentSuccessMessage, setDocumentSuccessMessage] = useState("");

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

  const loadGeneratedDocument = useCallback(async () => {
    try {
      setIsLoadingDocument(true);
      setDocumentErrorMessage("");

      const response = await fetch(
        `${API_URL}/contracts/admin/${params.id}/document`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      const data = (await response.json()) as GeneratedContractResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Documentul generat nu a putut fi încărcat.",
        );
      }

      setGeneratedDocument(data.document);
    } catch (error) {
      setDocumentErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la încărcarea documentului.",
      );
    } finally {
      setIsLoadingDocument(false);
    }
  }, [params.id]);

  const loadRanks = useCallback(async () => {
    try {
      setIsLoadingRanks(true);

      const response = await fetch(`${API_URL}/ranks/admin`, {
        method: "GET",
        credentials: "include",
      });

      const data = (await response.json()) as RanksResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Rank-urile nu au putut fi încărcate.");
      }

      const sortedRanks = [...(data.ranks ?? [])].sort(
        (firstRank, secondRank) =>
          firstRank.sort_order - secondRank.sort_order ||
          firstRank.name.localeCompare(secondRank.name, "ro"),
      );

      setRanks(sortedRanks);

      if (!selectedRankId && sortedRanks.length > 0) {
        const defaultCrewRank = sortedRanks.find(
          (rank) => rank.name.trim().toLowerCase() === "blackfold crew",
        );

        setSelectedRankId(String(defaultCrewRank?.id ?? sortedRanks[0].id));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la încărcarea rank-urilor.",
      );
    } finally {
      setIsLoadingRanks(false);
    }
  }, [selectedRankId]);

  function openApprovalModal() {
    setErrorMessage("");
    setScheduleMode("DEFAULT");
    setCustomWorkSchedule("");
    setContractType("UNLIMITED");
    setContractEndDate("");
    setIsApprovalModalOpen(true);

    if (ranks.length === 0) {
      void loadRanks();
    } else if (!selectedRankId) {
      const defaultCrewRank = ranks.find(
        (rank) => rank.name.trim().toLowerCase() === "blackfold crew",
      );

      setSelectedRankId(String(defaultCrewRank?.id ?? ranks[0].id));
    }
  }

  function closeApprovalModal() {
    if (isApproving) {
      return;
    }

    setIsApprovalModalOpen(false);
  }

  function openRegenerationModal() {
    if (!contract) {
      return;
    }

    setErrorMessage("");
    setDocumentErrorMessage("");
    setDocumentSuccessMessage("");

    const currentSchedule = contract.workSchedule?.trim() || "17:00 - 00:00";

    if (currentSchedule === "17:00 - 00:00") {
      setScheduleMode("DEFAULT");
      setCustomWorkSchedule("");
    } else {
      setScheduleMode("CUSTOM");
      setCustomWorkSchedule(currentSchedule);
    }

    setContractType(contract.contractType ?? "UNLIMITED");
    setContractEndDate(
      contract.contractType === "FIXED" && contract.contractEndDate
        ? contract.contractEndDate.slice(0, 10)
        : "",
    );

    setIsRegenerationModalOpen(true);
  }

  function closeRegenerationModal() {
    if (isGeneratingDocument) {
      return;
    }

    setIsRegenerationModalOpen(false);
  }

  async function handleApproveContract() {
    const rankId = Number(selectedRankId);
    const workSchedule =
      scheduleMode === "DEFAULT" ? "17:00 - 00:00" : customWorkSchedule.trim();

    if (!Number.isInteger(rankId) || rankId <= 0) {
      setErrorMessage("Selectează rank-ul angajatului.");
      return;
    }

    if (!workSchedule) {
      setErrorMessage("Completează programul de lucru.");
      return;
    }

    if (workSchedule.length > 50) {
      setErrorMessage("Programul de lucru poate avea maximum 50 de caractere.");
      return;
    }

    if (contractType === "FIXED" && !contractEndDate) {
      setErrorMessage(
        "Selectează data expirării pentru contractul pe perioadă determinată.",
      );
      return;
    }

    try {
      setIsApproving(true);
      setErrorMessage("");

      const response = await fetch(
        `${API_URL}/contracts/admin/${params.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            rankId,
            workSchedule,
            contractType,
            contractEndDate: contractType === "FIXED" ? contractEndDate : null,
          }),
        },
      );

      const data = (await response.json()) as ContractActionResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Contractul nu a putut fi aprobat.");
      }

      setIsApprovalModalOpen(false);
      await loadContract();
      window.dispatchEvent(new Event("contracts-updated"));
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
      window.dispatchEvent(new Event("contracts-updated"));
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

  async function handleGenerateContract() {
    try {
      setIsGeneratingDocument(true);
      setDocumentErrorMessage("");
      setDocumentSuccessMessage("");

      const response = await fetch(
        `${API_URL}/contracts/admin/${params.id}/generate`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = (await response.json()) as GenerateContractResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Contractul nu a putut fi generat.");
      }

      setDocumentSuccessMessage(
        data.message ?? "Contractul a fost generat cu succes.",
      );

      await loadGeneratedDocument();
    } catch (error) {
      setDocumentErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la generarea contractului.",
      );
    } finally {
      setIsGeneratingDocument(false);
    }
  }

  async function handleRegenerateContract() {
    const workSchedule =
      scheduleMode === "DEFAULT" ? "17:00 - 00:00" : customWorkSchedule.trim();

    if (!workSchedule) {
      setDocumentErrorMessage("Completează programul de lucru.");
      return;
    }

    if (workSchedule.length > 50) {
      setDocumentErrorMessage(
        "Programul de lucru poate avea maximum 50 de caractere.",
      );
      return;
    }

    if (contractType === "FIXED" && !contractEndDate) {
      setDocumentErrorMessage(
        "Selectează data expirării pentru contractul determinat.",
      );
      return;
    }

    try {
      setIsGeneratingDocument(true);
      setDocumentErrorMessage("");
      setDocumentSuccessMessage("");

      const response = await fetch(
        `${API_URL}/contracts/admin/${params.id}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            workSchedule,
            contractType,
            contractEndDate: contractType === "FIXED" ? contractEndDate : null,
          }),
        },
      );

      const data = (await response.json()) as GenerateContractResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Contractul nu a putut fi regenerat.");
      }

      setIsRegenerationModalOpen(false);
      setDocumentSuccessMessage(
        data.message ?? "Contractul a fost regenerat cu succes.",
      );

      await Promise.all([loadContract(), loadGeneratedDocument()]);
    } catch (error) {
      setDocumentErrorMessage(
        error instanceof Error
          ? error.message
          : "A apărut o eroare la regenerarea contractului.",
      );
    } finally {
      setIsGeneratingDocument(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void Promise.all([loadContract(), loadGeneratedDocument()]);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadContract, loadGeneratedDocument]);

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="p-8">
        <div className="mx-auto w-full">
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
                        src={`${API_URL}/api/contracts/admin/${contract.id}/identity-image`}
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

                      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                          Program
                        </p>

                        <p className="mt-2 font-medium text-white">
                          {contract.workSchedule ?? "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                          Tip contract
                        </p>

                        <p className="mt-2 font-medium text-white">
                          {contract.contractType === "FIXED"
                            ? "Determinat"
                            : contract.contractType === "UNLIMITED"
                              ? "Nedeterminat"
                              : "—"}
                        </p>
                      </div>

                      {contract.contractType === "FIXED" && (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                            Data expirării
                          </p>

                          <p className="mt-2 font-medium text-white">
                            {formatDate(contract.contractEndDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {contract.status === "APPROVED" && (
                  <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                      <div>
                        <div className="flex items-center gap-3">
                          <FileText size={21} className="text-amber-400" />

                          <h2 className="text-lg font-semibold text-white">
                            Contract individual de muncă
                          </h2>
                        </div>

                        <p className="mt-2 text-sm text-zinc-400">
                          Documentul oficial al angajatului în format PNG și
                          PDF.
                        </p>
                      </div>

                      {generatedDocument && (
                        <span className="inline-flex w-fit rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-300">
                          Versiunea {generatedDocument.currentVersion}
                        </span>
                      )}
                    </div>

                    {isLoadingDocument && (
                      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm text-zinc-400">
                          Se încarcă documentul...
                        </p>
                      </div>
                    )}

                    {!isLoadingDocument && documentErrorMessage && (
                      <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                        <p className="text-sm font-medium text-red-300">
                          {documentErrorMessage}
                        </p>
                      </div>
                    )}

                    {documentSuccessMessage && (
                      <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                        <p className="text-sm font-medium text-emerald-300">
                          {documentSuccessMessage}
                        </p>
                      </div>
                    )}

                    {!isLoadingDocument && !generatedDocument && (
                      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm text-zinc-300">
                          Contractul a fost aprobat, dar documentul oficial nu a
                          fost încă generat.
                        </p>

                        <button
                          type="button"
                          onClick={() => void handleGenerateContract()}
                          disabled={isGeneratingDocument}
                          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FilePlus2 size={18} />

                          {isGeneratingDocument
                            ? "Se generează..."
                            : "Generează contractul"}
                        </button>
                      </div>
                    )}

                    {!isLoadingDocument && generatedDocument && (
                      <div className="mt-6">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                            <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                              Număr document
                            </p>

                            <p className="mt-2 font-semibold text-white">
                              {generatedDocument.documentNumber}
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                            <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                              Versiune curentă
                            </p>

                            <p className="mt-2 font-semibold text-white">
                              v{generatedDocument.currentVersion}
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                            <p className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                              Generat la
                            </p>

                            <p className="mt-2 font-semibold text-white">
                              {formatDate(generatedDocument.generatedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                          <a
                            href={`${API_URL}${generatedDocument.pngPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
                          >
                            <Eye size={18} />
                            Vizualizează PNG
                          </a>

                          <a
                            href={`${API_URL}${generatedDocument.pdfPath}`}
                            download
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                          >
                            <Download size={18} />
                            Descarcă PDF
                          </a>

                          <button
                            type="button"
                            onClick={() => openRegenerationModal()}
                            disabled={isGeneratingDocument}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RefreshCw
                              size={18}
                              className={
                                isGeneratingDocument ? "animate-spin" : ""
                              }
                            />

                            {isGeneratingDocument
                              ? "Se regenerează..."
                              : "Regenerează contractul"}
                          </button>
                        </div>

                        <p className="mt-4 text-xs leading-5 text-zinc-500">
                          Regenerarea creează o versiune nouă. Versiunile
                          anterioare rămân salvate în istoricul documentelor.
                        </p>
                      </div>
                    )}
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
                      onClick={openApprovalModal}
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
      {isRegenerationModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-8 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRegenerationModal();
            }
          }}
        >
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-amber-500/25 bg-zinc-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-amber-400 uppercase">
                  Regenerare contract
                </p>

                <h2 className="mt-2 text-xl font-bold text-white">
                  Actualizează condițiile contractului
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Rank-ul rămâne neschimbat. Poți modifica programul și perioada
                  contractului înainte de regenerare.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRegenerationModal}
                disabled={isGeneratingDocument}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Închide fereastra"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-6">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 size={18} className="text-amber-400" />

                  <p className="text-sm font-semibold text-white">
                    Program de lucru
                  </p>
                </div>

                <div className="grid gap-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-amber-500/30">
                    <input
                      type="radio"
                      name="regeneration-schedule-mode"
                      value="DEFAULT"
                      checked={scheduleMode === "DEFAULT"}
                      onChange={() => setScheduleMode("DEFAULT")}
                      disabled={isGeneratingDocument}
                      className="mt-1 accent-amber-500"
                    />

                    <span>
                      <span className="block font-medium text-white">
                        Program implicit
                      </span>

                      <span className="mt-1 block text-sm text-zinc-400">
                        17:00 - 00:00
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-amber-500/30">
                    <input
                      type="radio"
                      name="regeneration-schedule-mode"
                      value="CUSTOM"
                      checked={scheduleMode === "CUSTOM"}
                      onChange={() => setScheduleMode("CUSTOM")}
                      disabled={isGeneratingDocument}
                      className="mt-1 accent-amber-500"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-white">
                        Program personalizat
                      </span>

                      <input
                        type="text"
                        value={customWorkSchedule}
                        onChange={(event) =>
                          setCustomWorkSchedule(event.target.value)
                        }
                        onFocus={() => setScheduleMode("CUSTOM")}
                        maxLength={50}
                        placeholder="Ex: 18:00 - 01:00"
                        disabled={
                          isGeneratingDocument || scheduleMode !== "CUSTOM"
                        }
                        className="mt-3 h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays size={18} className="text-amber-400" />

                  <p className="text-sm font-semibold text-white">
                    Perioada contractului
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-amber-500/30">
                    <input
                      type="radio"
                      name="regeneration-contract-type"
                      value="UNLIMITED"
                      checked={contractType === "UNLIMITED"}
                      onChange={() => {
                        setContractType("UNLIMITED");
                        setContractEndDate("");
                      }}
                      disabled={isGeneratingDocument}
                      className="mt-1 accent-amber-500"
                    />

                    <span>
                      <span className="block font-medium text-white">
                        Nedeterminat
                      </span>

                      <span className="mt-1 block text-xs text-zinc-500">
                        Fără dată de expirare
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-amber-500/30">
                    <input
                      type="radio"
                      name="regeneration-contract-type"
                      value="FIXED"
                      checked={contractType === "FIXED"}
                      onChange={() => setContractType("FIXED")}
                      disabled={isGeneratingDocument}
                      className="mt-1 accent-amber-500"
                    />

                    <span>
                      <span className="block font-medium text-white">
                        Determinat
                      </span>

                      <span className="mt-1 block text-xs text-zinc-500">
                        Necesită dată de expirare
                      </span>
                    </span>
                  </label>
                </div>

                {contractType === "FIXED" && (
                  <label className="mt-4 block">
                    <span className="mb-2 block text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                      Data expirării
                    </span>

                    <input
                      type="date"
                      value={contractEndDate}
                      onChange={(event) =>
                        setContractEndDate(event.target.value)
                      }
                      min={new Date().toISOString().split("T")[0]}
                      disabled={isGeneratingDocument}
                      className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                )}
              </div>

              {documentErrorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                  {documentErrorMessage}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-black/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={closeRegenerationModal}
                disabled={isGeneratingDocument}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anulează
              </button>

              <button
                type="button"
                onClick={() => void handleRegenerateContract()}
                disabled={isGeneratingDocument}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={18}
                  className={isGeneratingDocument ? "animate-spin" : ""}
                />

                {isGeneratingDocument
                  ? "Se regenerează..."
                  : "Salvează și regenerează"}
              </button>
            </div>
          </section>
        </div>
      )}

      {isApprovalModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-8 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeApprovalModal();
            }
          }}
        >
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-emerald-500/25 bg-zinc-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-emerald-400 uppercase">
                  Aprobare contract
                </p>

                <h2 className="mt-2 text-xl font-bold text-white">
                  Configurează angajarea
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Selectează rank-ul, programul și perioada contractului.
                </p>
              </div>

              <button
                type="button"
                onClick={closeApprovalModal}
                disabled={isApproving}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Închide fereastra"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-6">
              <div>
                <label
                  htmlFor="approval-rank"
                  className="mb-2 block text-xs font-semibold tracking-wide text-zinc-400 uppercase"
                >
                  Rank
                </label>

                <select
                  id="approval-rank"
                  value={selectedRankId}
                  onChange={(event) => setSelectedRankId(event.target.value)}
                  disabled={isApproving || isLoadingRanks}
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingRanks && (
                    <option value="">Se încarcă rank-urile...</option>
                  )}

                  {!isLoadingRanks && ranks.length === 0 && (
                    <option value="">Nu există rank-uri disponibile</option>
                  )}

                  {ranks.map((rank) => (
                    <option key={rank.id} value={rank.id}>
                      {rank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 size={18} className="text-emerald-400" />

                  <p className="text-sm font-semibold text-white">
                    Program de lucru
                  </p>
                </div>

                <div className="grid gap-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-emerald-500/30">
                    <input
                      type="radio"
                      name="schedule-mode"
                      value="DEFAULT"
                      checked={scheduleMode === "DEFAULT"}
                      onChange={() => setScheduleMode("DEFAULT")}
                      disabled={isApproving}
                      className="mt-1 accent-emerald-500"
                    />

                    <span>
                      <span className="block font-medium text-white">
                        Program implicit
                      </span>

                      <span className="mt-1 block text-sm text-zinc-400">
                        17:00 - 00:00
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-emerald-500/30">
                    <input
                      type="radio"
                      name="schedule-mode"
                      value="CUSTOM"
                      checked={scheduleMode === "CUSTOM"}
                      onChange={() => setScheduleMode("CUSTOM")}
                      disabled={isApproving}
                      className="mt-1 accent-emerald-500"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-white">
                        Program personalizat
                      </span>

                      <input
                        type="text"
                        value={customWorkSchedule}
                        onChange={(event) =>
                          setCustomWorkSchedule(event.target.value)
                        }
                        onFocus={() => setScheduleMode("CUSTOM")}
                        maxLength={50}
                        placeholder="Ex: 18:00 - 01:00"
                        disabled={isApproving || scheduleMode !== "CUSTOM"}
                        className="mt-3 h-11 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays size={18} className="text-emerald-400" />

                  <p className="text-sm font-semibold text-white">
                    Perioada contractului
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-emerald-500/30">
                    <input
                      type="radio"
                      name="contract-type"
                      value="UNLIMITED"
                      checked={contractType === "UNLIMITED"}
                      onChange={() => {
                        setContractType("UNLIMITED");
                        setContractEndDate("");
                      }}
                      disabled={isApproving}
                      className="mt-1 accent-emerald-500"
                    />

                    <span>
                      <span className="block font-medium text-white">
                        Nedeterminat
                      </span>

                      <span className="mt-1 block text-xs text-zinc-500">
                        Fără dată de expirare
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-emerald-500/30">
                    <input
                      type="radio"
                      name="contract-type"
                      value="FIXED"
                      checked={contractType === "FIXED"}
                      onChange={() => setContractType("FIXED")}
                      disabled={isApproving}
                      className="mt-1 accent-emerald-500"
                    />

                    <span>
                      <span className="block font-medium text-white">
                        Determinat
                      </span>

                      <span className="mt-1 block text-xs text-zinc-500">
                        Necesită dată de expirare
                      </span>
                    </span>
                  </label>
                </div>

                {contractType === "FIXED" && (
                  <label className="mt-4 block">
                    <span className="mb-2 block text-xs font-semibold tracking-wide text-zinc-400 uppercase">
                      Data expirării
                    </span>

                    <input
                      type="date"
                      value={contractEndDate}
                      onChange={(event) =>
                        setContractEndDate(event.target.value)
                      }
                      min={new Date().toISOString().split("T")[0]}
                      disabled={isApproving}
                      className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                )}
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-black/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={closeApprovalModal}
                disabled={isApproving}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anulează
              </button>

              <button
                type="button"
                onClick={() => void handleApproveContract()}
                disabled={isApproving || isLoadingRanks || ranks.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={18} />

                {isApproving ? "Se aprobă..." : "Aprobă contractul"}
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
