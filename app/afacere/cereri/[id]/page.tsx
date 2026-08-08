"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useCallback, useEffect, useState } from "react";

import { AlertCircle, ArrowLeft, FileText, RefreshCw } from "lucide-react";

import AppShell from "../../../components/AppShell";

import InactivityRequestAdmin from "./InactivityRequestAdmin";
import LeaveRequestAdmin from "./LeaveRequestAdmin";
import ResignRequestAdmin from "./ResignRequestAdmin";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type WorkflowStatusCode = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

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

interface WorkflowRequestsResponse {
  success: boolean;
  message?: string;
  data?: AdminWorkflowRequest[];
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

  const [isLoading, setIsLoading] = useState(true);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRequest = useCallback(
    async (showRefreshLoader = false) => {
      if (!Number.isInteger(workflowRequestId) || workflowRequestId <= 0) {
        setWorkflow(null);

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
        const response = await fetch(`${API_URL}/workflows/admin`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = (await response.json()) as WorkflowRequestsResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.message ?? "Cererea nu a putut fi încărcată.");
        }

        const currentWorkflow =
          data.data?.find((request) => request.id === workflowRequestId) ??
          null;

        if (!currentWorkflow) {
          throw new Error("Cererea nu a fost găsită.");
        }

        setWorkflow(currentWorkflow);
      } catch (error) {
        console.error("Failed to load workflow request:", error);

        setWorkflow(null);

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

  function dispatchWorkflowUpdated() {
    window.dispatchEvent(new Event("workflow-requests-updated"));
  }

  async function handleWorkflowUpdated() {
    dispatchWorkflowUpdated();
    await loadRequest(true);
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

            {isLoading ? (
              <div className="flex min-h-[450px] items-center justify-center">
                <RefreshCw className="h-10 w-10 animate-spin text-[#B8904D]" />
              </div>
            ) : !workflow ? (
              <EmptyRequest />
            ) : (
              <WorkflowRequestContent
                workflow={workflow}
                onWorkflowUpdated={handleWorkflowUpdated}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function WorkflowRequestContent({
  workflow,
  onWorkflowUpdated,
}: {
  workflow: AdminWorkflowRequest;
  onWorkflowUpdated: () => Promise<void>;
}) {
  switch (workflow.workflowTypeCode) {
    case "RESIGNATION":
      return (
        <ResignRequestAdmin
          workflow={workflow}
          onWorkflowUpdated={onWorkflowUpdated}
        />
      );

    case "LEAVE":
      return (
        <LeaveRequestAdmin
          workflow={workflow}
          onWorkflowUpdated={onWorkflowUpdated}
        />
      );

    case "INACTIVITY":
      return (
        <InactivityRequestAdmin
          workflow={workflow}
          onWorkflowUpdated={onWorkflowUpdated}
        />
      );

    default:
      return <UnsupportedWorkflow workflow={workflow} />;
  }
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
