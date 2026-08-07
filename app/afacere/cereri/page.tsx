"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import AppShell from "../../components/AppShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type WorkflowStatusCode = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface AdminWorkflowRequestListItem {
  id: number;
  requestNumber: string;

  workflowTypeCode: string;
  workflowTypeName: string;

  statusCode: WorkflowStatusCode;
  statusName: string;

  userId: number;
  employeeName: string;

  reviewedBy: number | null;
  reviewerName: string | null;
  reviewedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

interface WorkflowRequestsResponse {
  success: boolean;
  message?: string;
  data?: AdminWorkflowRequestListItem[];
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

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

function getStatusStyle(statusCode: WorkflowStatusCode) {
  switch (statusCode) {
    case "PENDING":
      return {
        label: "În așteptare",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      };

    case "APPROVED":
      return {
        label: "Aprobată",
        className: "border-green-500/30 bg-green-500/10 text-green-300",
      };

    case "REJECTED":
      return {
        label: "Respinsă",
        className: "border-red-500/30 bg-red-500/10 text-red-300",
      };

    case "CANCELLED":
      return {
        label: "Anulată",
        className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
      };
  }
}

function getWorkflowTypeLabel(code: string, fallback: string) {
  switch (code) {
    case "RESIGNATION":
      return "Demisie";
    case "INACTIVITY":
      return "Inactivitate";
    case "LEAVE":
      return "Concediu";
    default:
      return fallback;
  }
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminWorkflowRequestListItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const loadRequests = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/workflows/admin`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await response.json()) as WorkflowRequestsResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Cererile nu au putut fi încărcate.");
      }

      setRequests(data.data ?? []);
    } catch (error) {
      console.error("Failed to load admin workflow requests:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Pagina nu a putut fi încărcată.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRequests();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadRequests]);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.statusCode === "PENDING").length,
    [requests],
  );

  const approvedCount = useMemo(
    () =>
      requests.filter((request) => request.statusCode === "APPROVED").length,
    [requests],
  );

  const rejectedCount = useMemo(
    () =>
      requests.filter((request) => request.statusCode === "REJECTED").length,
    [requests],
  );

  const workflowTypes = useMemo(() => {
    const uniqueTypes = new Map<string, string>();

    for (const request of requests) {
      uniqueTypes.set(
        request.workflowTypeCode,
        getWorkflowTypeLabel(
          request.workflowTypeCode,
          request.workflowTypeName,
        ),
      );
    }

    return Array.from(uniqueTypes.entries());
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return requests.filter((request) => {
      if (statusFilter !== "ALL" && request.statusCode !== statusFilter) {
        return false;
      }

      if (typeFilter !== "ALL" && request.workflowTypeCode !== typeFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        request.requestNumber.toLowerCase().includes(normalizedSearch) ||
        request.employeeName.toLowerCase().includes(normalizedSearch) ||
        getWorkflowTypeLabel(request.workflowTypeCode, request.workflowTypeName)
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });
  }, [requests, search, statusFilter, typeFilter]);

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="mx-auto w-full p-5 md:p-8">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/45 shadow-2xl backdrop-blur-md">
          <header className="border-b border-white/10 p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm tracking-[0.2em] text-[#B8904D] uppercase">
                  Control Panel
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">Cereri</h1>

                  {pendingCount > 0 && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      {pendingCount} în așteptare
                    </span>
                  )}
                </div>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                  Vizualizează și gestionează toate cererile trimise de
                  angajați.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadRequests(true)}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Reîncarcă
              </button>
            </div>
          </header>

          <div className="p-5 md:p-8">
            {errorMessage && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <p className="font-semibold">A apărut o eroare</p>

                  <p className="mt-1 text-red-200/80">{errorMessage}</p>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <RefreshCw className="h-10 w-10 animate-spin text-[#B8904D]" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryCard
                    title="În așteptare"
                    value={pendingCount}
                    description="Necesită verificare"
                    icon={<Clock3 className="h-5 w-5" />}
                    className="border-amber-500/20 bg-amber-500/[0.05]"
                    iconClassName="text-amber-300"
                  />

                  <SummaryCard
                    title="Aprobate"
                    value={approvedCount}
                    description="Procese active"
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    className="border-green-500/20 bg-green-500/[0.05]"
                    iconClassName="text-green-300"
                  />

                  <SummaryCard
                    title="Respinse"
                    value={rejectedCount}
                    description="Cereri închise"
                    icon={<XCircle className="h-5 w-5" />}
                    className="border-red-500/20 bg-red-500/[0.05]"
                    iconClassName="text-red-300"
                  />
                </div>

                <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="relative w-full xl:max-w-md">
                    <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-zinc-500" />

                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Caută după cerere sau nume..."
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pr-4 pl-11 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#B8904D]/50"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/50"
                    >
                      <option value="ALL">Toate tipurile</option>

                      {workflowTypes.map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[#B8904D]/50"
                    >
                      <option value="ALL">Toate statusurile</option>
                      <option value="PENDING">În așteptare</option>
                      <option value="APPROVED">Aprobate</option>
                      <option value="REJECTED">Respinse</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  {filteredRequests.length === 0 ? (
                    <EmptyRequests />
                  ) : (
                    <div className="space-y-3">
                      {filteredRequests.map((request) => (
                        <RequestCard key={request.id} request={request} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  className,
  iconClassName,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  className: string;
  iconClassName: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>

          <p className="mt-2 text-3xl font-bold text-white">{value}</p>

          <p className="mt-1 text-xs text-zinc-500">{description}</p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-black/30 ${iconClassName}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function RequestCard({ request }: { request: AdminWorkflowRequestListItem }) {
  const status = getStatusStyle(request.statusCode);

  const workflowLabel = getWorkflowTypeLabel(
    request.workflowTypeCode,
    request.workflowTypeName,
  );

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#B8904D]/25 hover:bg-white/[0.055]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-semibold text-white">
              {request.requestNumber}
            </span>

            <span className="rounded-full border border-[#B8904D]/25 bg-[#B8904D]/10 px-2.5 py-1 text-[11px] font-semibold text-[#D5B477]">
              {workflowLabel}
            </span>

            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-zinc-500">Angajat:</span>{" "}
              <span className="font-medium text-zinc-200">
                {request.employeeName}
              </span>
            </div>

            <div>
              <span className="text-zinc-500">Creată:</span>{" "}
              <span className="text-zinc-300">
                {formatDateTime(request.createdAt)}
              </span>
            </div>

            {request.reviewerName && (
              <div>
                <span className="text-zinc-500">Verificată de:</span>{" "}
                <span className="text-zinc-300">{request.reviewerName}</span>
              </div>
            )}
          </div>
        </div>

        <Link
          href={`/afacere/cereri/${request.id}`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#B8904D]/30 bg-[#B8904D]/10 px-4 py-2.5 text-sm font-medium text-[#D5B477] transition hover:bg-[#B8904D]/20"
        >
          Detalii
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function EmptyRequests() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
        <ClipboardList className="h-8 w-8" />
      </div>

      <h2 className="mt-5 text-xl font-semibold text-white">
        Nicio cerere găsită
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
        Cererile trimise de angajați vor apărea aici.
      </p>
    </div>
  );
}
