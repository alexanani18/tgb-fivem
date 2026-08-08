"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Hourglass,
  RefreshCw,
  ShieldCheck,
  Shirt,
  User,
  X,
  XCircle,
} from "lucide-react";

import AppShell from "../../../components/AppShell";
import LeaveRequestAdmin from "./LeaveRequestAdmin";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type WorkflowStatusCode = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

type ModalType = "approve" | "reject" | "uniform" | "complete" | null;

interface AdminWorkflowRequest {
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

interface ResignationRequest {
  id: number;
  workflowRequestId: number;

  effectiveDate: string;
  reason: string;

  uniformReturned: boolean;
  uniformReturnedAt: string | null;
  uniformReturnedConfirmedBy: number | null;

  completedAt: string | null;
  completedBy: number | null;

  createdAt: string;
  updatedAt: string;
}

interface WorkflowRequestsResponse {
  success: boolean;
  message?: string;
  data?: AdminWorkflowRequest[];
}

interface ResignationResponse {
  success: boolean;
  message?: string;
  data?: ResignationRequest;
}

interface MutationResponse {
  success: boolean;
  message?: string;
}

function formatDate(value: string | null): string {
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
  }).format(date);
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

export default function AdminRequestDetailsPage() {
  const params = useParams<{ id: string }>();

  const workflowRequestId = Number(params.id);

  const [workflow, setWorkflow] = useState<AdminWorkflowRequest | null>(null);

  const [resignation, setResignation] = useState<ResignationRequest | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [modalType, setModalType] = useState<ModalType>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadRequest = useCallback(
    async (showRefreshLoader = false) => {
      if (!Number.isInteger(workflowRequestId) || workflowRequestId <= 0) {
        setErrorMessage("ID-ul cererii este invalid.");
        setIsLoading(false);
        return;
      }

      if (showRefreshLoader) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const [workflowsResponse, resignationResponse] = await Promise.all([
          fetch(`${API_URL}/workflows/admin`, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }),

          fetch(`${API_URL}/resignations/${workflowRequestId}`, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }),
        ]);

        const workflowsData =
          (await workflowsResponse.json()) as WorkflowRequestsResponse;

        if (!workflowsResponse.ok || !workflowsData.success) {
          throw new Error(
            workflowsData.message ?? "Cererea nu a putut fi încărcată.",
          );
        }

        const currentWorkflow =
          workflowsData.data?.find(
            (request) => request.id === workflowRequestId,
          ) ?? null;

        if (!currentWorkflow) {
          throw new Error("Cererea nu a fost găsită.");
        }

        setWorkflow(currentWorkflow);

        if (currentWorkflow.workflowTypeCode === "RESIGNATION") {
          const resignationData =
            (await resignationResponse.json()) as ResignationResponse;

          if (
            !resignationResponse.ok ||
            !resignationData.success ||
            !resignationData.data
          ) {
            throw new Error(
              resignationData.message ??
                "Detaliile demisiei nu au putut fi încărcate.",
            );
          }

          setResignation(resignationData.data);
        } else {
          setResignation(null);
        }
      } catch (error) {
        console.error("Failed to load workflow request details:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Cererea nu a putut fi încărcată.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [workflowRequestId],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRequest();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadRequest]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  const resignationStage = useMemo(() => {
    if (!workflow || !resignation) {
      return null;
    }

    if (workflow.statusCode === "REJECTED") {
      return "REJECTED";
    }

    if (workflow.statusCode === "CANCELLED") {
      return "CANCELLED";
    }

    if (resignation.completedAt) {
      return "COMPLETED";
    }

    if (workflow.statusCode === "APPROVED" && resignation.uniformReturned) {
      return "READY_TO_COMPLETE";
    }

    if (workflow.statusCode === "APPROVED") {
      return "WAITING_UNIFORM";
    }

    return "PENDING";
  }, [workflow, resignation]);

  function closeModal() {
    if (isProcessing) {
      return;
    }

    setModalType(null);
    setRejectionReason("");
  }

  function dispatchWorkflowUpdated() {
    window.dispatchEvent(new Event("workflow-requests-updated"));
  }

  async function executeAction() {
    if (!workflow) {
      return;
    }

    if (modalType === "reject") {
      const reason = rejectionReason.trim();

      if (!reason) {
        setErrorMessage("Motivul respingerii este obligatoriu.");
        return;
      }

      if (reason.length > 1000) {
        setErrorMessage(
          "Motivul respingerii poate avea maximum 1000 de caractere.",
        );
        return;
      }
    }

    let endpoint = "";
    let body: Record<string, unknown> | undefined;
    let successFallback = "";

    switch (modalType) {
      case "approve":
        endpoint = `/resignations/${workflow.id}/approve`;
        successFallback = "Cererea de demisie a fost aprobată.";
        break;

      case "reject":
        endpoint = `/resignations/${workflow.id}/reject`;
        body = {
          rejectionReason: rejectionReason.trim(),
        };
        successFallback = "Cererea de demisie a fost respinsă.";
        break;

      case "uniform":
        endpoint = `/resignations/${workflow.id}/uniform-return`;
        successFallback = "Predarea uniformei a fost confirmată.";
        break;

      case "complete":
        endpoint = `/resignations/${workflow.id}/complete`;
        successFallback = "Demisia a fost finalizată.";
        break;

      default:
        return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: body
          ? {
              "Content-Type": "application/json",
            }
          : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = (await response.json()) as MutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Operația nu a putut fi efectuată.");
      }

      setSuccessMessage(successFallback);

      setModalType(null);
      setRejectionReason("");

      dispatchWorkflowUpdated();

      await loadRequest(true);
    } catch (error) {
      console.error("Failed to process resignation action:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Operația nu a putut fi efectuată.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="mx-auto w-full p-5 md:p-8">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/45 shadow-2xl backdrop-blur-md">
          <header className="border-b border-white/10 p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link
                  href="/afacere/cereri"
                  className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-[#B8904D]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Înapoi la cereri
                </Link>

                <p className="mt-5 text-sm tracking-[0.2em] text-[#B8904D] uppercase">
                  Control Panel · Cereri
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">
                    {workflow?.requestNumber ?? "Detalii cerere"}
                  </h1>

                  {workflow && (
                    <>
                      <span className="rounded-full border border-[#B8904D]/30 bg-[#B8904D]/10 px-3 py-1 text-xs font-semibold text-[#D5B477]">
                        {getWorkflowTypeLabel(
                          workflow.workflowTypeCode,
                          workflow.workflowTypeName,
                        )}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          getStatusStyle(workflow.statusCode).className
                        }`}
                      >
                        {getStatusStyle(workflow.statusCode).label}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadRequest(true)}
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

            {successMessage && (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
                <Check className="h-5 w-5 shrink-0" />
                <p>{successMessage}</p>
              </div>
            )}

            {isLoading ? (
              <div className="flex min-h-[450px] items-center justify-center">
                <RefreshCw className="h-10 w-10 animate-spin text-[#B8904D]" />
              </div>
            ) : !workflow ? (
              <EmptyRequest />
            ) : workflow.workflowTypeCode === "LEAVE" ? (
              <LeaveRequestAdmin
                workflow={workflow}
                onWorkflowUpdated={async () => {
                  dispatchWorkflowUpdated();
                  await loadRequest(true);
                }}
              />
            ) : workflow.workflowTypeCode !== "RESIGNATION" ? (
              <UnsupportedWorkflow workflow={workflow} />
            ) : !resignation ? (
              <EmptyRequest />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B8904D]/15 text-[#B8904D]">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div>
                        <h2 className="font-semibold text-white">
                          Detalii demisie
                        </h2>

                        <p className="text-xs text-zinc-400">
                          Informațiile trimise de angajat
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <InfoCard
                        icon={<User className="h-4 w-4" />}
                        label="Angajat"
                        value={workflow.employeeName}
                      />

                      <InfoCard
                        icon={<CalendarDays className="h-4 w-4" />}
                        label="Data solicitată"
                        value={formatDate(resignation.effectiveDate)}
                      />

                      <InfoCard
                        icon={<Clock3 className="h-4 w-4" />}
                        label="Cerere creată"
                        value={formatDateTime(workflow.createdAt)}
                      />

                      <InfoCard
                        icon={<ClipboardCheck className="h-4 w-4" />}
                        label="Verificată de"
                        value={workflow.reviewerName ?? "—"}
                      />
                    </div>

                    <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-5">
                      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Motivul demisiei
                      </p>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-200">
                        {resignation.reason}
                      </p>
                    </div>
                  </section>

                  <AdminActions
                    workflow={workflow}
                    resignation={resignation}
                    stage={resignationStage}
                    openModal={setModalType}
                  />
                </div>

                <ResignationProgress
                  workflow={workflow}
                  resignation={resignation}
                />

                <ReviewInformation
                  workflow={workflow}
                  resignation={resignation}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {modalType && workflow && (
        <ActionModal
          type={modalType}
          employeeName={workflow.employeeName}
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
          isProcessing={isProcessing}
          closeModal={closeModal}
          confirm={() => void executeAction()}
        />
      )}
    </AppShell>
  );
}

function AdminActions({
  workflow,
  resignation,
  stage,
  openModal,
}: {
  workflow: AdminWorkflowRequest;
  resignation: ResignationRequest;
  stage: string | null;
  openModal: (type: ModalType) => void;
}) {
  return (
    <section className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div>
        <p className="text-xs tracking-[0.15em] text-[#B8904D] uppercase">
          Administrare
        </p>

        <h2 className="mt-2 text-lg font-semibold text-white">
          Acțiuni cerere
        </h2>
      </div>

      {stage === "PENDING" && (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <p className="text-sm font-medium text-amber-200">
              Cererea așteaptă o decizie.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openModal("approve")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#B8904D] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#C8A15F]"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aprobă cererea
          </button>

          <button
            type="button"
            onClick={() => openModal("reject")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
          >
            <XCircle className="h-4 w-4" />
            Respinge cererea
          </button>
        </div>
      )}

      {stage === "WAITING_UNIFORM" && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-[#B8904D]/25 bg-[#B8904D]/[0.06] p-4">
            <div className="flex gap-3">
              <Shirt className="mt-0.5 h-5 w-5 shrink-0 text-[#B8904D]" />

              <div>
                <p className="text-sm font-semibold text-white">
                  Așteaptă predarea uniformei
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  Angajatul rămâne activ până când uniforma este predată și
                  demisia este finalizată.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openModal("uniform")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#B8904D] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#C8A15F]"
          >
            <Shirt className="h-4 w-4" />
            Confirmă predarea uniformei
          </button>
        </div>
      )}

      {stage === "READY_TO_COMPLETE" && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-green-500/25 bg-green-500/[0.06] p-4">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />

              <div>
                <p className="text-sm font-semibold text-green-200">
                  Uniforma a fost predată
                </p>

                <p className="mt-1 text-xs leading-5 text-green-200/70">
                  Cererea poate fi finalizată.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openModal("complete")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-green-400"
          >
            <ShieldCheck className="h-4 w-4" />
            Finalizează demisia
          </button>
        </div>
      )}

      {stage === "COMPLETED" && (
        <div className="mt-5 rounded-xl border border-green-500/25 bg-green-500/[0.06] p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />

            <div>
              <p className="text-sm font-semibold text-green-200">
                Demisie finalizată
              </p>

              <p className="mt-1 text-xs leading-5 text-green-200/70">
                Procesul a fost încheiat la{" "}
                {formatDateTime(resignation.completedAt)}.
              </p>
            </div>
          </div>
        </div>
      )}

      {stage === "REJECTED" && (
        <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
          <div className="flex gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

            <div>
              <p className="text-sm font-semibold text-red-200">
                Cerere respinsă
              </p>

              <p className="mt-1 text-xs text-red-200/70">
                Nu mai sunt disponibile alte acțiuni pentru această cerere.
              </p>
            </div>
          </div>
        </div>
      )}

      {stage === "CANCELLED" && (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-400">
          Cererea a fost anulată.
        </div>
      )}

      <div className="mt-5 border-t border-white/10 pt-4 text-xs text-zinc-500">
        <p>
          Cerere:{" "}
          <span className="text-zinc-300">{workflow.requestNumber}</span>
        </p>
      </div>
    </section>
  );
}

function ResignationProgress({
  workflow,
  resignation,
}: {
  workflow: AdminWorkflowRequest;
  resignation: ResignationRequest;
}) {
  const rejected = workflow.statusCode === "REJECTED";

  const approved = workflow.statusCode === "APPROVED";

  const uniformReturned = resignation.uniformReturned;

  const completed = Boolean(resignation.completedAt);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
      <div>
        <p className="text-xs tracking-[0.15em] text-[#B8904D] uppercase">
          Progres
        </p>

        <h2 className="mt-2 text-lg font-semibold text-white">
          Procesul demisiei
        </h2>
      </div>

      {rejected ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ProgressStep
            completed
            label="Cerere trimisă"
            description="Cererea a fost înregistrată."
          />

          <ProgressStep
            failed
            label="Cerere respinsă"
            description={`${workflow.reviewerName} a respins cererea.`}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ProgressStep
            completed
            icon={<FileText className="h-4 w-4" />}
            label="Cerere trimisă"
            description="Cererea este înregistrată."
          />

          <ProgressStep
            completed={approved}
            active={!approved}
            icon={<ClipboardCheck className="h-4 w-4" />}
            label="Aprobare"
            description={
              approved
                ? "Cererea a fost aprobată."
                : "Așteaptă decizia administratorului."
            }
          />

          <ProgressStep
            completed={uniformReturned}
            active={approved && !uniformReturned}
            icon={<Shirt className="h-4 w-4" />}
            label="Uniformă"
            description={
              uniformReturned
                ? "Uniforma a fost predată."
                : approved
                  ? "Așteaptă predarea uniformei."
                  : "Disponibil după aprobare."
            }
          />

          <ProgressStep
            completed={completed}
            active={uniformReturned && !completed}
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Finalizare"
            description={
              completed
                ? "Demisia este finalizată."
                : uniformReturned
                  ? "Pregătită pentru finalizare."
                  : "Proces nefinalizat."
            }
          />
        </div>
      )}
    </section>
  );
}

function ReviewInformation({
  workflow,
  resignation,
}: {
  workflow: AdminWorkflowRequest;
  resignation: ResignationRequest;
}) {
  if (
    !workflow.reviewedAt &&
    !resignation.uniformReturnedAt &&
    !resignation.completedAt
  ) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
      <h2 className="text-lg font-semibold text-white">Informații proces</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <InfoCard
          label="Verificare"
          value={
            workflow.reviewedAt
              ? `${workflow.reviewerName ?? "Administrator"} · ${formatDateTime(
                  workflow.reviewedAt,
                )}`
              : "—"
          }
        />

        <InfoCard
          label="Uniformă predată"
          value={
            resignation.uniformReturnedAt
              ? formatDateTime(resignation.uniformReturnedAt)
              : "—"
          }
        />

        <InfoCard
          label="Finalizare"
          value={
            resignation.completedAt
              ? formatDateTime(resignation.completedAt)
              : "—"
          }
        />
      </div>
    </section>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        {icon}
        <span>{label}</span>
      </div>

      <p className="mt-2 text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function ProgressStep({
  label,
  description,
  icon,
  completed = false,
  active = false,
  failed = false,
}: {
  label: string;
  description: string;
  icon?: ReactNode;
  completed?: boolean;
  active?: boolean;
  failed?: boolean;
}) {
  const className = failed
    ? "border-red-500/30 bg-red-500/[0.06]"
    : completed
      ? "border-green-500/25 bg-green-500/[0.06]"
      : active
        ? "border-[#B8904D]/30 bg-[#B8904D]/[0.06]"
        : "border-white/10 bg-black/20";

  const iconClassName = failed
    ? "text-red-400"
    : completed
      ? "text-green-400"
      : active
        ? "text-[#B8904D]"
        : "text-zinc-600";

  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <div className="flex items-center gap-2">
        <div className={iconClassName}>
          {failed ? (
            <XCircle className="h-4 w-4" />
          ) : completed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : active ? (
            <Hourglass className="h-4 w-4" />
          ) : (
            (icon ?? <Clock3 className="h-4 w-4" />)
          )}
        </div>

        <p className="text-sm font-semibold text-white">{label}</p>
      </div>

      <p className="mt-2 text-xs leading-5 text-zinc-500">{description}</p>
    </div>
  );
}

function ActionModal({
  type,
  employeeName,
  rejectionReason,
  setRejectionReason,
  isProcessing,
  closeModal,
  confirm,
}: {
  type: Exclude<ModalType, null>;
  employeeName: string;
  rejectionReason: string;
  setRejectionReason: (value: string) => void;
  isProcessing: boolean;
  closeModal: () => void;
  confirm: () => void;
}) {
  const content = {
    approve: {
      title: "Aprobă cererea",
      description: `Confirmi aprobarea cererii de demisie pentru ${employeeName}? Angajatul va rămâne activ până la predarea uniformei și finalizarea demisiei.`,
      button: "Aprobă cererea",
      danger: false,
    },

    reject: {
      title: "Respinge cererea",
      description: `Cererea lui ${employeeName} va fi respinsă. Completează motivul respingerii.`,
      button: "Respinge cererea",
      danger: true,
    },

    uniform: {
      title: "Confirmă predarea uniformei",
      description: `Confirmi că ${employeeName} a predat uniforma? După această acțiune, demisia va putea fi finalizată.`,
      button: "Confirmă uniforma",
      danger: false,
    },

    complete: {
      title: "Finalizează demisia",
      description: `Confirmi finalizarea demisiei lui ${employeeName}? Angajatul va deveni DEMISIONAT și contul va fi scos din fluxul activ de angajați.`,
      button: "Finalizează demisia",
      danger: true,
    },
  }[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-xs tracking-[0.15em] text-[#B8904D] uppercase">
              Confirmare
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              {content.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={isProcessing}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm leading-6 text-zinc-300">
            {content.description}
          </p>

          {type === "reject" && (
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">
                Motivul respingerii
              </span>

              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                maxLength={1000}
                rows={5}
                placeholder="Scrie motivul respingerii..."
                className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500/40"
              />

              <p className="mt-1 text-right text-xs text-zinc-500">
                {rejectionReason.length}/1000
              </p>
            </label>
          )}

          {type === "complete" && (
            <div className="mt-5 flex gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

              <p className="text-xs leading-5 text-red-200/80">
                Această acțiune finalizează procesul de demisie. Execută
                operația numai după ce predarea uniformei a fost confirmată.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 p-5">
          <button
            type="button"
            onClick={closeModal}
            disabled={isProcessing}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            Anulează
          </button>

          <button
            type="button"
            onClick={confirm}
            disabled={
              isProcessing || (type === "reject" && !rejectionReason.trim())
            }
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              content.danger
                ? "bg-red-500 text-white hover:bg-red-400"
                : "bg-[#B8904D] text-black hover:bg-[#C8A15F]"
            }`}
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : type === "reject" ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}

            {content.button}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnsupportedWorkflow({ workflow }: { workflow: AdminWorkflowRequest }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 text-center">
      <FileText className="h-10 w-10 text-[#B8904D]" />

      <h2 className="mt-5 text-xl font-semibold text-white">
        {getWorkflowTypeLabel(
          workflow.workflowTypeCode,
          workflow.workflowTypeName,
        )}
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
        Interfața administrativă pentru acest tip de cerere nu este implementată
        încă.
      </p>
    </div>
  );
}

function EmptyRequest() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 text-center">
      <AlertCircle className="h-10 w-10 text-zinc-500" />

      <h2 className="mt-5 text-xl font-semibold text-white">
        Cererea nu a fost găsită
      </h2>

      <Link
        href="/afacere/cereri"
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#B8904D]/30 bg-[#B8904D]/10 px-4 py-2.5 text-sm text-[#D5B477]"
      >
        <ArrowLeft className="h-4 w-4" />
        Înapoi la cereri
      </Link>
    </div>
  );
}
