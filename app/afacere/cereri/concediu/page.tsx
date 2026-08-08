"use client";

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Hourglass,
  RefreshCw,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import AppShell from "../../../components/AppShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type WorkflowStatusCode = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface LeaveListItem {
  workflowRequestId: number;
  requestNumber: string;

  userId: number;
  employeeName: string;
  username: string;

  statusCode: WorkflowStatusCode;
  statusName: string;

  startDate: string;
  endDate: string;
  reason: string;

  reviewedBy: number | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;

  createdAt: string;
  updatedAt: string;
}

interface LeavesResponse {
  success: boolean;
  message?: string;
  data?: LeaveListItem[];
}

interface MutationResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

interface LeaveForm {
  startDate: string;
  endDate: string;
  reason: string;
  confirmed: boolean;
}

interface DatePickerProps {
  value: string;
  minimumDate: string;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
}

function getTodayDate(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createEmptyForm(): LeaveForm {
  const today = getTodayDate();

  return {
    startDate: today,
    endDate: today,
    reason: "",
    confirmed: false,
  };
}

function parseDateOnly(value: string): Date | null {
  const normalizedValue = value.includes("T") ? value.slice(0, 10) : value;

  const [year, month, day] = normalizedValue.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDateValue(value: string): string {
  return value.includes("T") ? value.slice(0, 10) : value;
}

function formatDateInputValue(value: string): string {
  const date = parseDateOnly(value);

  if (!date) {
    return "Selectează data";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
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

function getStatusAppearance(leave: LeaveListItem): {
  label: string;
  className: string;
} {
  switch (leave.statusCode) {
    case "PENDING":
      return {
        label: "În așteptarea aprobării",
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
        className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
      };

    default:
      return {
        label: leave.statusName,
        className: "border-white/10 bg-white/5 text-zinc-300",
      };
  }
}

export default function LeavePage() {
  const [leaves, setLeaves] = useState<LeaveListItem[]>([]);
  const [form, setForm] = useState<LeaveForm>(createEmptyForm);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [leaveToDelete, setLeaveToDelete] = useState<LeaveListItem | null>(
    null,
  );

  const [isDeleting, setIsDeleting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeRequestsCount = useMemo(
    () =>
      leaves.filter(
        (leave) =>
          leave.statusCode === "PENDING" || leave.statusCode === "APPROVED",
      ).length,
    [leaves],
  );

  const duration = useMemo(
    () => getLeaveDuration(form.startDate, form.endDate),
    [form.startDate, form.endDate],
  );

  const loadPageData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const response = await fetch(`${API_URL}/leaves/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = (await response.json()) as LeavesResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Cererile de concediu nu au putut fi încărcate.",
        );
      }

      setLeaves(data.data ?? []);
    } catch (error) {
      console.error("Failed to load leave requests:", error);

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

  async function submitLeave() {
    setErrorMessage(null);
    setSuccessMessage(null);

    const startDate = form.startDate.trim();
    const endDate = form.endDate.trim();
    const reason = form.reason.trim();

    if (!startDate) {
      setErrorMessage("Selectează data de început a concediului.");
      return;
    }

    if (!endDate) {
      setErrorMessage("Selectează data de sfârșit a concediului.");
      return;
    }

    const today = getTodayDate();

    if (startDate < today) {
      setErrorMessage("Data de început a concediului nu poate fi în trecut.");
      return;
    }

    if (endDate < startDate) {
      setErrorMessage("Data de sfârșit nu poate fi înaintea datei de început.");
      return;
    }

    if (!reason) {
      setErrorMessage("Motivul concediului este obligatoriu.");
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
      const response = await fetch(`${API_URL}/leaves`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          reason,
        }),
      });

      const data = (await response.json()) as MutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Cererea de concediu nu a putut fi trimisă.",
        );
      }

      setForm(createEmptyForm());

      setSuccessMessage(data.message ?? "Cererea de concediu a fost trimisă.");

      await loadPageData(true);
    } catch (error) {
      console.error("Failed to create leave request:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Cererea nu a putut fi trimisă.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteLeave() {
    if (!leaveToDelete) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${API_URL}/leaves/me/${leaveToDelete.workflowRequestId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = (await response.json()) as MutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Cererea de concediu nu a putut fi ștearsă.",
        );
      }

      setLeaveToDelete(null);

      setSuccessMessage(data.message ?? "Cererea de concediu a fost ștearsă.");

      await loadPageData(true);
    } catch (error) {
      console.error("Failed to delete leave request:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Cererea de concediu nu a putut fi ștearsă.",
      );
    } finally {
      setIsDeleting(false);
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
                    Cerere de concediu
                  </h1>

                  {activeRequestsCount > 0 && (
                    <span className="rounded-full border border-[#B8904D]/30 bg-[#B8904D]/10 px-3 py-1 text-xs font-semibold text-[#D5B477]">
                      {activeRequestsCount}{" "}
                      {activeRequestsCount === 1
                        ? "cerere activă"
                        : "cereri active"}
                    </span>
                  )}
                </div>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                  Selectează perioada concediului, completează motivul și
                  urmărește statusul cererii după trimitere.
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
              <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                <LeaveFormCard
                  form={form}
                  setForm={setForm}
                  duration={duration}
                  isSubmitting={isSubmitting}
                  onSubmit={submitLeave}
                />

                <LeaveHistory
                  leaves={leaves}
                  onDelete={(leave) => setLeaveToDelete(leave)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {leaveToDelete && (
        <DeleteLeaveModal
          leave={leaveToDelete}
          isDeleting={isDeleting}
          onClose={() => {
            if (!isDeleting) {
              setLeaveToDelete(null);
            }
          }}
          onConfirm={() => void deleteLeave()}
        />
      )}
    </AppShell>
  );
}

function LeaveFormCard({
  form,
  setForm,
  duration,
  isSubmitting,
  onSubmit,
}: {
  form: LeaveForm;
  setForm: Dispatch<SetStateAction<LeaveForm>>;
  duration: number;
  isSubmitting: boolean;
  onSubmit: () => Promise<void>;
}) {
  function updateStartDate(value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      startDate: value,
      endDate: currentForm.endDate < value ? value : currentForm.endDate,
    }));
  }

  return (
    <section className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#B8904D]/15 text-[#B8904D]">
          <CalendarDays className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-semibold text-white">Cerere nouă</h2>

          <p className="text-xs text-zinc-400">
            Completează perioada și motivul concediului
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div>
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              De la
            </span>

            <DatePicker
              value={form.startDate}
              minimumDate={getTodayDate()}
              ariaLabel="Selectează data de început"
              onChange={updateStartDate}
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Până la
            </span>

            <DatePicker
              value={form.endDate}
              minimumDate={form.startDate}
              ariaLabel="Selectează data de sfârșit"
              onChange={(value) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  endDate: value,
                }))
              }
            />
          </div>
        </div>

        {duration > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-[#B8904D]/20 bg-[#B8904D]/[0.06] px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Clock3 className="h-4 w-4 text-[#B8904D]" />
              Durata concediului
            </div>

            <strong className="text-sm text-[#D5B477]">
              {duration} {duration === 1 ? "zi" : "zile"}
            </strong>
          </div>
        )}

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-300">
            Motiv
          </span>

          <textarea
            value={form.reason}
            maxLength={1000}
            rows={7}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                reason: event.target.value,
              }))
            }
            placeholder="Descrie motivul cererii de concediu..."
            className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#B8904D]/60"
          />

          <p className="mt-1 text-right text-xs text-zinc-500">
            {form.reason.length}/1000
          </p>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-[#B8904D]/30 hover:bg-[#B8904D]/[0.04]">
          <input
            type="checkbox"
            checked={form.confirmed}
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
              Înțeleg că perioada de concediu intră în vigoare doar după
              aprobarea cererii de către un administrator.
            </p>
          </div>
        </label>

        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={isSubmitting}
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

function DatePicker({
  value,
  minimumDate,
  disabled = false,
  ariaLabel,
  onChange,
}: DatePickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedDate = parseDateOnly(value) ?? parseDateOnly(getTodayDate())!;

  const [isOpen, setIsOpen] = useState(false);

  const [displayMonth, setDisplayMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleMouseDown(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen]);

  function togglePicker() {
    if (disabled) {
      return;
    }

    if (!isOpen) {
      const current = parseDateOnly(value) ?? parseDateOnly(minimumDate);

      if (current) {
        setDisplayMonth(new Date(current.getFullYear(), current.getMonth(), 1));
      }
    }

    setIsOpen((currentValue) => !currentValue);
  }

  function selectDate(date: Date) {
    const minimum = parseDateOnly(minimumDate);

    if (minimum && date < minimum) {
      return;
    }

    onChange(toDateInputValue(date));
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={togglePicker}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-left text-sm text-white outline-none transition hover:border-[#B8904D]/40 focus:border-[#B8904D]/60 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span>{formatDateInputValue(value)}</span>

        <CalendarDays className="h-4 w-4 shrink-0 text-zinc-300" />
      </button>

      {isOpen && (
        <DatePickerPopover
          value={value}
          minimumDate={minimumDate}
          month={displayMonth}
          ariaLabel={ariaLabel}
          onMonthChange={setDisplayMonth}
          onSelectDate={selectDate}
        />
      )}
    </div>
  );
}

function DatePickerPopover({
  value,
  minimumDate,
  month,
  ariaLabel,
  onMonthChange,
  onSelectDate,
}: {
  value: string;
  minimumDate: string;
  month: Date;
  ariaLabel: string;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: Date) => void;
}) {
  const selectedDate = parseDateOnly(value);
  const minimum = parseDateOnly(minimumDate);

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);

  const mondayOffset = (firstDay.getDay() + 6) % 7;

  const calendarStart = new Date(
    month.getFullYear(),
    month.getMonth(),
    1 - mondayOffset,
  );

  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);

    return day;
  });

  const monthLabel = new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
  }).format(month);

  const weekDays = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];

  function changeMonth(offset: number) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      className="absolute top-[calc(100%+10px)] left-0 z-50 w-[310px] rounded-2xl border border-white/10 bg-[#0B0B0B]/98 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition hover:border-[#B8904D]/40 hover:bg-[#B8904D]/10 hover:text-[#D5B477]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="text-sm font-semibold text-white capitalize">
          {monthLabel}
        </p>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition hover:border-[#B8904D]/40 hover:bg-[#B8904D]/10 hover:text-[#D5B477]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {weekDays.map((weekDay) => (
          <div
            key={weekDay}
            className="flex h-8 items-center justify-center text-[11px] font-semibold tracking-wide text-zinc-500 uppercase"
          >
            {weekDay}
          </div>
        ))}

        {days.map((date) => {
          const isCurrentMonth = date.getMonth() === month.getMonth();

          const unavailable = minimum !== null && date < minimum;

          const selected =
            selectedDate !== null && isSameDay(date, selectedDate);

          return (
            <button
              key={toDateInputValue(date)}
              type="button"
              disabled={unavailable}
              onClick={() => onSelectDate(date)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition ${
                selected
                  ? "bg-[#B8904D] text-black shadow-[0_0_18px_rgba(184,144,77,0.20)]"
                  : unavailable
                    ? "cursor-not-allowed text-zinc-700"
                    : isCurrentMonth
                      ? "text-zinc-200 hover:bg-[#B8904D]/15 hover:text-[#D5B477]"
                      : "text-zinc-600 hover:bg-white/5 hover:text-zinc-400"
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-zinc-500">
        Format dată: zz/ll/aaaa
      </div>
    </div>
  );
}

function LeaveHistory({
  leaves,
  onDelete,
}: {
  leaves: LeaveListItem[];
  onDelete: (leave: LeaveListItem) => void;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Cererile mele</h2>

        <p className="mt-1 text-sm text-zinc-400">
          {leaves.length === 0
            ? "Nu ai trimis nicio cerere de concediu."
            : `${leaves.length} ${
                leaves.length === 1
                  ? "cerere înregistrată"
                  : "cereri înregistrate"
              }`}
        </p>
      </div>

      {leaves.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
            <CalendarDays className="h-8 w-8" />
          </div>

          <h3 className="mt-5 text-xl font-semibold text-white">
            Nicio cerere
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
            După ce trimiți o cerere de concediu, aceasta va apărea aici
            împreună cu statusul și perioada solicitată.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {leaves.map((leave) => (
            <LeaveCard
              key={leave.workflowRequestId}
              leave={leave}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LeaveCard({
  leave,
  onDelete,
}: {
  leave: LeaveListItem;
  onDelete: (leave: LeaveListItem) => void;
}) {
  const status = getStatusAppearance(leave);

  const duration = getLeaveDuration(
    normalizeDateValue(leave.startDate),
    normalizeDateValue(leave.endDate),
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-white">
                {leave.requestNumber}
              </h3>

              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
              >
                {status.label}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {duration} {duration === 1 ? "zi" : "zile"}
              </span>

              <span>Trimisă: {formatDateTime(leave.createdAt)}</span>
            </div>
          </div>

          {leave.statusCode === "PENDING" && (
            <button
              type="button"
              onClick={() => onDelete(leave)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3.5 py-2 text-xs font-semibold text-red-300 transition hover:border-red-500/40 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Șterge cererea
            </button>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Motiv
          </p>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">
            {leave.reason}
          </p>
        </div>

        {leave.statusCode === "REJECTED" && leave.rejectionReason && (
          <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

              <div>
                <p className="text-sm font-semibold text-red-200">
                  Motivul respingerii
                </p>

                <p className="mt-2 text-sm leading-6 text-red-200/80">
                  {leave.rejectionReason}
                </p>
              </div>
            </div>
          </div>
        )}

        <LeaveProgress leave={leave} />

        {leave.reviewedAt && (
          <p className="mt-4 text-xs text-zinc-500">
            {leave.statusCode === "APPROVED"
              ? "Aprobată"
              : leave.statusCode === "REJECTED"
                ? "Respinsă"
                : "Verificată"}{" "}
            {leave.reviewerName
              ? `de ${leave.reviewerName}`
              : "de administrator"}{" "}
            la {formatDateTime(leave.reviewedAt)}
          </p>
        )}
      </div>
    </article>
  );
}

function DeleteLeaveModal({
  leave,
  isDeleting,
  onClose,
  onConfirm,
}: {
  leave: LeaveListItem;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#101010] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Trash2 className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">
                Ștergi cererea?
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                {leave.requestNumber}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm leading-6 text-zinc-300">
            Cererea de concediu pentru perioada{" "}
            <strong className="font-semibold text-white">
              {formatDate(leave.startDate)}
            </strong>{" "}
            –{" "}
            <strong className="font-semibold text-white">
              {formatDate(leave.endDate)}
            </strong>{" "}
            va fi ștearsă definitiv.
          </p>

          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Poți șterge cererea deoarece aceasta nu a fost încă aprobată.
          </p>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              Renunță
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Șterge cererea
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaveProgress({ leave }: { leave: LeaveListItem }) {
  if (leave.statusCode === "REJECTED") {
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
          description="Cererea nu a fost aprobată."
        />
      </div>
    );
  }

  if (leave.statusCode === "CANCELLED") {
    return (
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ProgressStep
          completed
          label="Cerere trimisă"
          description="Cererea a fost înregistrată."
        />

        <ProgressStep
          label="Cerere anulată"
          description="Cererea nu mai este activă."
        />
      </div>
    );
  }

  const approved = leave.statusCode === "APPROVED";

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <ProgressStep
        completed
        icon={<FileText className="h-4 w-4" />}
        label="Cerere trimisă"
        description="Cererea a fost înregistrată în sistem."
      />

      <ProgressStep
        completed={approved}
        active={!approved}
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Aprobare"
        description={
          approved
            ? "Cererea de concediu a fost aprobată."
            : "Cererea așteaptă verificarea unui administrator."
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
  icon?: ReactNode;
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
