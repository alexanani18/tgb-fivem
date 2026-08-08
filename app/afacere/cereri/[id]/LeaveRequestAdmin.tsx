"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  RefreshCw,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type WorkflowStatusCode = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveAdminWorkflow {
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

interface LeaveRequest {
  id: number;
  workflowRequestId: number;

  startDate: string;
  endDate: string;
  reason: string;

  createdAt: string;
  updatedAt: string;
}

interface LeaveResponse {
  success: boolean;
  message?: string;
  data?: LeaveRequest;
}

interface MutationResponse {
  success: boolean;
  message?: string;
}

type ModalType = "approve" | "reject" | "delete" | null;

interface LeaveRequestAdminProps {
  workflow: LeaveAdminWorkflow;
  onWorkflowUpdated: () => Promise<void> | void;
}

function parseDateOnly(value: string): Date | null {
  const normalized = value.includes("T") ? value.slice(0, 10) : value;

  const [year, month, day] = normalized.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = parseDateOnly(value);

  if (!date) {
    return "Dată indisponibilă";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
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

function getLeaveDuration(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || end < start) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
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

export default function LeaveRequestAdmin({
  workflow,
  onWorkflowUpdated,
}: LeaveRequestAdminProps) {
  const router = useRouter();

  const [leave, setLeave] = useState<LeaveRequest | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [modalType, setModalType] = useState<ModalType>(null);

  const [rejectionReason, setRejectionReason] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const duration = useMemo(() => {
    if (!leave) {
      return 0;
    }

    return getLeaveDuration(leave.startDate, leave.endDate);
  }, [leave]);

  const loadLeave = useCallback(
    async (showRefreshLoader = false) => {
      if (showRefreshLoader) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const response = await fetch(`${API_URL}/leaves/${workflow.id}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = (await response.json()) as LeaveResponse;

        if (!response.ok || !data.success || !data.data) {
          throw new Error(
            data.message ?? "Detaliile concediului nu au putut fi încărcate.",
          );
        }

        setLeave(data.data);
      } catch (error) {
        console.error("Failed to load admin leave details:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Detaliile concediului nu au putut fi încărcate.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [workflow.id],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLeave();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadLeave]);

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

  async function processAction() {
    if (!modalType) {
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

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let response: Response;

      if (modalType === "approve") {
        response = await fetch(`${API_URL}/leaves/${workflow.id}/approve`, {
          method: "POST",
          credentials: "include",
        });
      } else if (modalType === "reject") {
        response = await fetch(`${API_URL}/leaves/${workflow.id}/reject`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rejectionReason: rejectionReason.trim(),
          }),
        });
      } else {
        response = await fetch(`${API_URL}/leaves/${workflow.id}`, {
          method: "DELETE",
          credentials: "include",
        });
      }

      const data = (await response.json()) as MutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Operația nu a putut fi efectuată.");
      }

      dispatchWorkflowUpdated();

      if (modalType === "delete") {
        setModalType(null);

        router.replace("/afacere/cereri");
        router.refresh();

        return;
      }

      setSuccessMessage(
        data.message ??
          (modalType === "approve"
            ? "Cererea de concediu a fost aprobată."
            : "Cererea de concediu a fost respinsă."),
      );

      setModalType(null);
      setRejectionReason("");

      await onWorkflowUpdated();
      await loadLeave(true);
    } catch (error) {
      console.error("Failed to process leave action:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Operația nu a putut fi efectuată.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[450px] items-center justify-center">
        <RefreshCw className="h-10 w-10 animate-spin text-[#B8904D]" />
      </div>
    );
  }

  if (!leave) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-zinc-500" />

        <h2 className="mt-4 text-lg font-semibold text-white">
          Detaliile concediului nu sunt disponibile
        </h2>

        <p className="mt-2 text-sm text-zinc-400">
          Cererea nu a putut fi încărcată.
        </p>
      </div>
    );
  }

  const statusStyle = getStatusStyle(workflow.statusCode);

  return (
    <>
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

      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B8904D]/15 text-[#B8904D]">
                  <CalendarDays className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-semibold text-white">Detalii concediu</h2>

                  <p className="text-xs text-zinc-400">
                    Informațiile trimise de angajat
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadLeave(true)}
                disabled={isRefreshing}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 disabled:opacity-40"
                title="Reîncarcă"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={<User className="h-4 w-4" />}
                label="Angajat"
                value={workflow.employeeName}
              />

              <InfoCard
                icon={<CalendarDays className="h-4 w-4" />}
                label="De la"
                value={formatDate(leave.startDate)}
              />

              <InfoCard
                icon={<CalendarDays className="h-4 w-4" />}
                label="Până la"
                value={formatDate(leave.endDate)}
              />

              <InfoCard
                icon={<Clock3 className="h-4 w-4" />}
                label="Durată"
                value={`${duration} ${duration === 1 ? "zi" : "zile"}`}
              />

              <InfoCard
                icon={<FileText className="h-4 w-4" />}
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
                Motivul concediului
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-200">
                {leave.reason}
              </p>
            </div>
          </section>

          <section className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div>
              <p className="text-xs tracking-[0.15em] text-[#B8904D] uppercase">
                Administrare
              </p>

              <h2 className="mt-2 text-lg font-semibold text-white">
                Acțiuni cerere
              </h2>
            </div>

            <div className="mt-5">
              <span
                className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyle.className}`}
              >
                {statusStyle.label}
              </span>
            </div>

            {workflow.statusCode === "PENDING" && (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                  <p className="text-sm font-medium text-amber-200">
                    Cererea așteaptă o decizie.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-200/70">
                    Verifică perioada și motivul înainte de aprobare.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModalType("approve")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#B8904D] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#C8A15F]"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aprobă cererea
                </button>

                <button
                  type="button"
                  onClick={() => setModalType("reject")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
                >
                  <XCircle className="h-4 w-4" />
                  Respinge cererea
                </button>
              </div>
            )}

            {workflow.statusCode === "APPROVED" && (
              <div className="mt-5 rounded-xl border border-green-500/25 bg-green-500/[0.06] p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />

                  <div>
                    <p className="text-sm font-semibold text-green-200">
                      Concediu aprobat
                    </p>

                    <p className="mt-1 text-xs leading-5 text-green-200/70">
                      Statusul angajatului este gestionat automat în funcție de
                      perioada concediului.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {workflow.statusCode === "REJECTED" && (
              <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
                <div className="flex gap-3">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

                  <div>
                    <p className="text-sm font-semibold text-red-200">
                      Cerere respinsă
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-200/70">
                      Cererea nu a fost aprobată.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {workflow.statusCode === "CANCELLED" && (
              <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-400">
                Cererea a fost anulată.
              </div>
            )}

            <div className="mt-5 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={() => setModalType("delete")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm font-medium text-red-300 transition hover:border-red-500/40 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />

                {workflow.statusCode === "APPROVED"
                  ? "Șterge concediul"
                  : "Șterge cererea"}
              </button>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4 text-xs text-zinc-500">
              <p>
                Cerere:{" "}
                <span className="text-zinc-300">{workflow.requestNumber}</span>
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
          <p className="text-xs tracking-[0.15em] text-[#B8904D] uppercase">
            Perioadă
          </p>

          <h2 className="mt-2 text-lg font-semibold text-white">
            Concediul solicitat
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <PeriodCard label="Început" value={formatDate(leave.startDate)} />

            <PeriodCard label="Sfârșit" value={formatDate(leave.endDate)} />

            <PeriodCard
              label="Durată totală"
              value={`${duration} ${duration === 1 ? "zi" : "zile"}`}
            />
          </div>
        </section>

        {workflow.reviewedAt && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
            <p className="text-xs tracking-[0.15em] text-[#B8904D] uppercase">
              Verificare
            </p>

            <h2 className="mt-2 text-lg font-semibold text-white">
              Informații administrare
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon={<ClipboardCheck className="h-4 w-4" />}
                label="Verificată de"
                value={workflow.reviewerName ?? "Administrator"}
              />

              <InfoCard
                icon={<Clock3 className="h-4 w-4" />}
                label="Data verificării"
                value={formatDateTime(workflow.reviewedAt)}
              />
            </div>
          </section>
        )}
      </div>

      {modalType && (
        <ActionModal
          type={modalType}
          workflow={workflow}
          leave={leave}
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
          isProcessing={isProcessing}
          onClose={closeModal}
          onConfirm={() => void processAction()}
        />
      )}
    </>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="text-[#B8904D]">{icon}</span>
        {label}
      </div>

      <p className="mt-2 text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function PeriodCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#B8904D]/20 bg-[#B8904D]/[0.05] p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>

      <p className="mt-2 text-base font-semibold text-[#D5B477]">{value}</p>
    </div>
  );
}

function ActionModal({
  type,
  workflow,
  leave,
  rejectionReason,
  setRejectionReason,
  isProcessing,
  onClose,
  onConfirm,
}: {
  type: Exclude<ModalType, null>;
  workflow: LeaveAdminWorkflow;
  leave: LeaveRequest;
  rejectionReason: string;
  setRejectionReason: (value: string) => void;
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isApprove = type === "approve";
  const isReject = type === "reject";
  const isDelete = type === "delete";

  const title = isApprove
    ? "Aprobă concediul"
    : isReject
      ? "Respinge concediul"
      : workflow.statusCode === "APPROVED"
        ? "Șterge concediul"
        : "Șterge cererea";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#101010] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                isApprove
                  ? "bg-[#B8904D]/15 text-[#B8904D]"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {isApprove ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isDelete ? (
                <Trash2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>

              <p className="mt-1 text-sm text-zinc-400">
                {workflow.employeeName} · {workflow.requestNumber}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
            <p>
              Perioadă:{" "}
              <strong className="text-white">
                {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
              </strong>
            </p>
          </div>

          {isApprove && (
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              Confirmi aprobarea acestei cereri de concediu? Angajatul va intra
              automat în statusul{" "}
              <strong className="text-white">CONCEDIU</strong> când începe
              perioada.
            </p>
          )}

          {isReject && (
            <div className="mt-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">
                  Motivul respingerii
                </span>

                <textarea
                  value={rejectionReason}
                  maxLength={1000}
                  rows={5}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="Introdu motivul respingerii..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#B8904D]/60"
                />

                <p className="mt-1 text-right text-xs text-zinc-500">
                  {rejectionReason.length}/1000
                </p>
              </label>
            </div>
          )}

          {isDelete && (
            <>
              <div className="mt-4 flex gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

                <div>
                  <p className="text-sm font-semibold text-red-200">
                    Acțiune definitivă
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-200/70">
                    Cererea va fi ștearsă definitiv din sistem.
                  </p>
                </div>
              </div>

              {workflow.statusCode === "APPROVED" && (
                <p className="mt-4 text-sm leading-6 text-zinc-300">
                  Dacă angajatul se află momentan în acest concediu, statusul
                  lui va fi recalculat imediat. Dacă nu mai există alt concediu
                  activ, va reveni la{" "}
                  <strong className="text-white">ACTIV</strong>.
                </p>
              )}
            </>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              Renunță
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                isApprove
                  ? "bg-[#B8904D] text-black hover:bg-[#C8A15F]"
                  : "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15"
              }`}
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : isApprove ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : isDelete ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}

              {isApprove
                ? "Aprobă cererea"
                : isReject
                  ? "Respinge cererea"
                  : workflow.statusCode === "APPROVED"
                    ? "Șterge concediul"
                    : "Șterge cererea"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
