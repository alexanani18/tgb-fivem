"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Hourglass,
  RefreshCw,
  Send,
  Shirt,
  XCircle,
} from "lucide-react";

import AppShell from "../../../components/AppShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type WorkflowStatusCode = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface ResignationListItem {
  workflowRequestId: number;
  requestNumber: string;

  userId: number;
  employeeName: string;
  username: string;

  statusCode: WorkflowStatusCode;
  statusName: string;

  effectiveDate: string;
  reason: string;

  uniformReturned: boolean;
  completedAt: string | null;

  reviewedBy: number | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;

  createdAt: string;
  updatedAt: string;
}

interface ResignationsResponse {
  success: boolean;
  message?: string;
  data?: ResignationListItem[];
}

interface MutationResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

interface ResignationForm {
  effectiveDate: string;
  reason: string;
  confirmed: boolean;
}

const EMPTY_FORM: ResignationForm = {
  effectiveDate: "",
  reason: "",
  confirmed: false,
};

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
  }).format(date);
}

function formatDateTime(dateValue: string | null): string {
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

function getTodayValue(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getResignationDisplayStatus(resignation: ResignationListItem): {
  label: string;
  className: string;
} {
  if (resignation.completedAt) {
    return {
      label: "Demisie finalizată",
      className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    };
  }

  if (resignation.statusCode === "PENDING") {
    return {
      label: "În așteptarea aprobării",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    };
  }

  if (resignation.statusCode === "REJECTED") {
    return {
      label: "Respinsă",
      className: "border-red-500/30 bg-red-500/10 text-red-300",
    };
  }

  if (resignation.statusCode === "CANCELLED") {
    return {
      label: "Anulată",
      className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
    };
  }

  if (resignation.statusCode === "APPROVED" && !resignation.uniformReturned) {
    return {
      label: "Așteaptă predarea uniformei",
      className: "border-[#B8904D]/40 bg-[#B8904D]/10 text-[#D5B477]",
    };
  }

  if (resignation.statusCode === "APPROVED" && resignation.uniformReturned) {
    return {
      label: "Pregătită pentru finalizare",
      className: "border-green-500/30 bg-green-500/10 text-green-300",
    };
  }

  return {
    label: resignation.statusName,
    className: "border-white/10 bg-white/5 text-zinc-300",
  };
}

export default function ResignationPage() {
  const [resignations, setResignations] = useState<ResignationListItem[]>([]);

  const [form, setForm] = useState<ResignationForm>(EMPTY_FORM);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeResignation = useMemo(
    () =>
      resignations.find(
        (resignation) =>
          resignation.statusCode === "PENDING" ||
          (resignation.statusCode === "APPROVED" && !resignation.completedAt),
      ) ?? null,
    [resignations],
  );

  const loadPageData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const resignationsResponse = await fetch(`${API_URL}/resignations/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const resignationsData =
        (await resignationsResponse.json()) as ResignationsResponse;

      if (!resignationsResponse.ok || !resignationsData.success) {
        throw new Error(
          resignationsData.message ??
            "Cererile de demisie nu au putut fi încărcate.",
        );
      }

      setResignations(resignationsData.data ?? []);
    } catch (error) {
      console.error("Failed to load resignation page:", error);

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
      void loadPageData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadPageData]);

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

  function resetMessages() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function submitResignation() {
    resetMessages();

    if (activeResignation) {
      setErrorMessage("Ai deja o cerere de demisie activă.");
      return;
    }

    const effectiveDate = form.effectiveDate.trim();
    const reason = form.reason.trim();

    if (!effectiveDate) {
      setErrorMessage("Selectează data dorită pentru demisie.");
      return;
    }

    if (effectiveDate < getTodayValue()) {
      setErrorMessage("Data demisiei nu poate fi în trecut.");
      return;
    }

    if (!reason) {
      setErrorMessage("Motivul demisiei este obligatoriu.");
      return;
    }

    if (reason.length > 1000) {
      setErrorMessage("Motivul poate avea maximum 1000 de caractere.");
      return;
    }

    if (!form.confirmed) {
      setErrorMessage("Trebuie să confirmi trimiterea cererii.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/resignations`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          effectiveDate,
          reason,
        }),
      });

      const data = (await response.json()) as MutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Cererea de demisie nu a putut fi trimisă.",
        );
      }

      setForm(EMPTY_FORM);

      setSuccessMessage(data.message ?? "Cererea de demisie a fost trimisă.");

      await loadPageData(true);
    } catch (error) {
      console.error("Failed to create resignation request:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Cererea nu a putut fi trimisă.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="mx-auto w-full p-5 md:p-8">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/45 shadow-2xl backdrop-blur-md">
          <header className="border-b border-white/10 p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm tracking-[0.2em] text-[#B8904D] uppercase">
                  Afacere · Cereri
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">
                    Cerere de demisie
                  </h1>

                  {activeResignation && (
                    <span className="rounded-full border border-[#B8904D]/30 bg-[#B8904D]/10 px-3 py-1 text-xs font-semibold text-[#D5B477]">
                      Cerere activă
                    </span>
                  )}
                </div>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                  Trimite o cerere de demisie și urmărește progresul acesteia
                  până la finalizarea procesului.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadPageData(true)}
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
              <div className="flex min-h-[400px] items-center justify-center">
                <RefreshCw className="h-10 w-10 animate-spin text-[#B8904D]" />
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
                <ResignationFormCard
                  form={form}
                  setForm={setForm}
                  activeResignation={activeResignation}
                  isSubmitting={isSubmitting}
                  submitResignation={submitResignation}
                />

                <ResignationHistory resignations={resignations} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

interface ResignationFormCardProps {
  form: ResignationForm;
  setForm: React.Dispatch<React.SetStateAction<ResignationForm>>;
  activeResignation: ResignationListItem | null;
  isSubmitting: boolean;
  submitResignation: () => Promise<void>;
}

function ResignationFormCard({
  form,
  setForm,
  activeResignation,
  isSubmitting,
  submitResignation,
}: ResignationFormCardProps) {
  const disabled = Boolean(activeResignation);

  return (
    <section className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B8904D]/15 text-[#B8904D]">
          <FileText className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-semibold text-white">Cerere nouă</h2>

          <p className="text-xs text-zinc-400">
            Completează informațiile necesare
          </p>
        </div>
      </div>

      {activeResignation && (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-4">
          <div className="flex items-start gap-3">
            <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />

            <div>
              <p className="text-sm font-semibold text-amber-200">
                Ai deja o cerere activă
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-200/70">
                {activeResignation.requestNumber} trebuie finalizată înainte de
                a putea trimite o altă cerere.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-300">
            Data dorită a demisiei
          </span>

          <input
            type="date"
            value={form.effectiveDate}
            min={getTodayValue()}
            disabled={disabled}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                effectiveDate: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-[#B8904D]/60 disabled:cursor-not-allowed disabled:opacity-40"
          />

          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Aceasta este data solicitată. Demisia nu este finalizată automat
            până când uniforma nu este predată și confirmată de un
            administrator.
          </p>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-300">
            Motiv
          </span>

          <textarea
            value={form.reason}
            disabled={disabled}
            maxLength={1000}
            rows={7}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                reason: event.target.value,
              }))
            }
            placeholder="Descrie motivul cererii de demisie..."
            className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#B8904D]/60 disabled:cursor-not-allowed disabled:opacity-40"
          />

          <p className="mt-1 text-right text-xs text-zinc-500">
            {form.reason.length}/1000
          </p>
        </label>

        <label
          className={`flex items-start gap-3 rounded-xl border p-4 transition ${
            disabled
              ? "cursor-not-allowed border-white/5 bg-black/20 opacity-40"
              : "cursor-pointer border-white/10 bg-black/30 hover:border-[#B8904D]/30 hover:bg-[#B8904D]/[0.04]"
          }`}
        >
          <input
            type="checkbox"
            checked={form.confirmed}
            disabled={disabled}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                confirmed: event.target.checked,
              }))
            }
            className="mt-1 h-4 w-4 shrink-0 accent-[#B8904D]"
          />

          <div>
            <p className="text-sm font-medium text-white">
              Confirm trimiterea cererii
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Înțeleg că demisia va trebui aprobată și că uniforma trebuie
              predată înainte de finalizarea procesului.
            </p>
          </div>
        </label>

        <button
          type="button"
          onClick={() => void submitResignation()}
          disabled={isSubmitting || disabled}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#B8904D] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#C8A15F] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Trimite cererea
        </button>
      </div>
    </section>
  );
}

function ResignationHistory({
  resignations,
}: {
  resignations: ResignationListItem[];
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Cererile mele</h2>

        <p className="mt-1 text-sm text-zinc-400">
          {resignations.length === 0
            ? "Nu ai trimis nicio cerere de demisie."
            : `${resignations.length} ${
                resignations.length === 1
                  ? "cerere înregistrată"
                  : "cereri înregistrate"
              }`}
        </p>
      </div>

      {resignations.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
            <FileText className="h-8 w-8" />
          </div>

          <h3 className="mt-5 text-xl font-semibold text-white">
            Nicio cerere
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
            După ce trimiți o cerere de demisie, progresul ei va fi afișat aici.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {resignations.map((resignation) => (
            <ResignationCard
              key={resignation.workflowRequestId}
              resignation={resignation}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ResignationCard({
  resignation,
}: {
  resignation: ResignationListItem;
}) {
  const displayStatus = getResignationDisplayStatus(resignation);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-white">
                {resignation.requestNumber}
              </h3>

              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${displayStatus.className}`}
              >
                {displayStatus.label}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Data solicitată:{" "}
                <strong className="text-zinc-300">
                  {formatDate(resignation.effectiveDate)}
                </strong>
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                Trimisă: {formatDateTime(resignation.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Motiv
          </p>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">
            {resignation.reason}
          </p>
        </div>

        {resignation.statusCode === "REJECTED" &&
          resignation.rejectionReason && (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

                <div>
                  <p className="text-sm font-semibold text-red-200">
                    Motivul respingerii
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-200/80">
                    {resignation.rejectionReason}
                  </p>
                </div>
              </div>
            </div>
          )}

        <ResignationProgress resignation={resignation} />

        {resignation.reviewedAt && (
          <div className="mt-4 text-xs text-zinc-500">
            {resignation.statusCode === "APPROVED"
              ? "Aprobată"
              : resignation.statusCode === "REJECTED"
                ? "Respinsă"
                : "Verificată"}{" "}
            {resignation.reviewerName
              ? `de ${resignation.reviewerName}`
              : "de administrator"}{" "}
            la {formatDateTime(resignation.reviewedAt)}
          </div>
        )}
      </div>
    </article>
  );
}

function ResignationProgress({
  resignation,
}: {
  resignation: ResignationListItem;
}) {
  const approved = resignation.statusCode === "APPROVED";

  const rejected = resignation.statusCode === "REJECTED";

  const uniformReturned = resignation.uniformReturned;

  const completed = Boolean(resignation.completedAt);

  if (rejected) {
    return (
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ProgressStep
          completed
          label="Cerere trimisă"
          description="Cererea a fost înregistrată."
        />

        <ProgressStep
          failed
          label="Cerere respinsă"
          description={`${resignation.reviewerName} a respins cererea.`}
        />
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ProgressStep
        completed
        icon={<FileText className="h-4 w-4" />}
        label="Cerere trimisă"
        description="Înregistrată în sistem."
      />

      <ProgressStep
        completed={approved}
        active={!approved}
        icon={<ClipboardCheck className="h-4 w-4" />}
        label="Aprobare"
        description={
          approved ? "Cererea a fost aprobată." : "Așteaptă administratorul."
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
              ? "Așteaptă predarea."
              : "Disponibil după aprobare."
        }
      />

      <ProgressStep
        completed={completed}
        active={uniformReturned && !completed}
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Finalizare"
        description={
          completed
            ? "Demisia este finalizată."
            : uniformReturned
              ? "Așteaptă finalizarea."
              : "Proces nefinalizat."
        }
      />
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
  icon?: React.ReactNode;
  completed?: boolean;
  active?: boolean;
  failed?: boolean;
}) {
  const stateClass = failed
    ? "border-red-500/30 bg-red-500/[0.07]"
    : completed
      ? "border-green-500/25 bg-green-500/[0.06]"
      : active
        ? "border-[#B8904D]/30 bg-[#B8904D]/[0.07]"
        : "border-white/10 bg-black/20";

  const iconClass = failed
    ? "text-red-400"
    : completed
      ? "text-green-400"
      : active
        ? "text-[#B8904D]"
        : "text-zinc-600";

  return (
    <div className={`rounded-xl border p-3 ${stateClass}`}>
      <div className="flex items-center gap-2">
        <div className={iconClass}>
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
