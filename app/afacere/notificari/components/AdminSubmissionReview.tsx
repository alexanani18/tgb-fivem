"use client";

import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

interface PendingSubmission {
  id: number;
  notification_image_id: number;
  uploaded_by: number;

  file_path: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;

  status: "PENDING";

  reviewed_by: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;

  created_at: string;
  updated_at: string;

  uploader_username: string;

  requested_image_path: string;
  requested_image_position: number;
  requested_image_display_name: string | null;

  notification_id: number;
  notification_title: string;
  notification_message: string;
}

interface PendingSubmissionsResponse {
  success: boolean;
  message?: string;
  submissions?: PendingSubmission[];
}

interface MutationResponse {
  success: boolean;
  message?: string;
}

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Dată indisponibilă";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminSubmissionReview() {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<number, string>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [processingSubmissionId, setProcessingSubmissionId] = useState<
    number | null
  >(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadPendingSubmissions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `${API_URL}/api/notification-submissions/review/pending`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      const contentType = response.headers.get("content-type");

      if (!contentType?.includes("application/json")) {
        throw new Error(
          `Serverul nu a returnat JSON. Status: ${response.status}`,
        );
      }

      const data = (await response.json()) as PendingSubmissionsResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Dovezile pentru review nu au putut fi încărcate.",
        );
      }

      setSubmissions(data.submissions ?? []);
    } catch (error) {
      console.error("Failed to load pending submissions:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Dovezile pentru review nu au putut fi încărcate.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPendingSubmissions();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadPendingSubmissions]);

  async function approveSubmission(submissionId: number) {
    setProcessingSubmissionId(submissionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${API_URL}/api/notification-submissions/${submissionId}/approve`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const data = (await response.json()) as MutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Dovada nu a putut fi aprobată.");
      }

      setSubmissions((currentSubmissions) =>
        currentSubmissions.filter(
          (submission) => submission.id !== submissionId,
        ),
      );

      setSuccessMessage(data.message ?? "Dovada a fost aprobată.");
    } catch (error) {
      console.error("Failed to approve submission:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Dovada nu a putut fi aprobată.",
      );
    } finally {
      setProcessingSubmissionId(null);
    }
  }

  async function rejectSubmission(submissionId: number) {
    const reason = rejectionReasons[submissionId]?.trim() ?? "";

    setProcessingSubmissionId(submissionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `${API_URL}/api/notification-submissions/${submissionId}/reject`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason,
          }),
        },
      );

      const data = (await response.json()) as MutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Dovada nu a putut fi respinsă.");
      }

      setSubmissions((currentSubmissions) =>
        currentSubmissions.filter(
          (submission) => submission.id !== submissionId,
        ),
      );

      setRejectionReasons((currentReasons) => {
        const nextReasons = { ...currentReasons };

        delete nextReasons[submissionId];

        return nextReasons;
      });

      setSuccessMessage(data.message ?? "Dovada a fost respinsă.");
    } catch (error) {
      console.error("Failed to reject submission:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Dovada nu a putut fi respinsă.",
      );
    } finally {
      setProcessingSubmissionId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 p-10 text-zinc-300">
        <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
        Se încarcă dovezile...
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Dovezi în așteptare</h2>

          <p className="mt-1 text-sm text-zinc-400">
            Verifică imaginile încărcate de angajați.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPendingSubmissions()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Reîncarcă
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-[#B8904D]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{successMessage}</p>
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[#B8904D]" />

          <h3 className="mt-4 text-lg font-semibold text-white">
            Nu există dovezi în așteptare
          </h3>

          <p className="mt-2 text-sm text-zinc-400">
            Toate dovezile au fost verificate.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {submissions.map((submission) => {
            const isProcessing = processingSubmissionId === submission.id;

            return (
              <article
                key={submission.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/50"
              >
                <div className="border-b border-white/10 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {submission.notification_title}
                      </h3>

                      <p className="mt-1 text-sm text-zinc-400">
                        Angajat:{" "}
                        <span className="font-medium text-zinc-200">
                          {submission.uploader_username}
                        </span>
                      </p>

                      <p className="mt-1 text-sm text-zinc-500">
                        Imaginea {submission.requested_image_position}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300">
                      <Clock3 className="h-4 w-4" />
                      {formatDate(submission.created_at)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-zinc-300">
                      Imaginea cerută
                    </p>

                    <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
                      <Image
                        src={submission.requested_image_path}
                        alt="Imagine cerută"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-zinc-300">
                      Dovada încărcată
                    </p>

                    <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
                      <Image
                        src={`${API_URL}/api/notification-submissions/file/${submission.id}`}
                        alt="Dovadă încărcată"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 p-5">
                  <label
                    htmlFor={`rejection-reason-${submission.id}`}
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Motivul respingerii
                  </label>

                  <textarea
                    id={`rejection-reason-${submission.id}`}
                    value={rejectionReasons[submission.id] ?? ""}
                    onChange={(event) =>
                      setRejectionReasons((currentReasons) => ({
                        ...currentReasons,
                        [submission.id]: event.target.value,
                      }))
                    }
                    maxLength={1000}
                    disabled={isProcessing}
                    placeholder="Exemplu: poza este neclară sau nu corespunde cerinței."
                    className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 disabled:opacity-50"
                  />

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void approveSubmission(submission.id)}
                      disabled={isProcessing}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Aprobă
                    </button>

                    <button
                      type="button"
                      onClick={() => void rejectSubmission(submission.id)}
                      disabled={isProcessing}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Respinge
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
