"use client";

import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  History,
  ImagePlus,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import type {
  NotificationImage,
  NotificationImageSubmission,
  SubmissionMutationResponse,
  SubmissionsResponse,
} from "../types";

const API_URL = "http://localhost:5000";

interface EmployeeNotificationImageProps {
  image: NotificationImage;
  imageNumber: number;
}

function formatSubmissionDate(dateValue: string): string {
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

function formatFileSize(fileSize: number): string {
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return "Dimensiune necunoscută";
  }

  const megabytes = fileSize / (1024 * 1024);

  if (megabytes >= 1) {
    return `${megabytes.toFixed(2)} MB`;
  }

  const kilobytes = fileSize / 1024;

  return `${kilobytes.toFixed(0)} KB`;
}

export default function EmployeeNotificationImage({
  image,
  imageNumber,
}: EmployeeNotificationImageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [submissions, setSubmissions] = useState<NotificationImageSubmission[]>(
    [],
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const latestSubmission = useMemo(() => {
    return submissions[0] ?? null;
  }, [submissions]);

  const hasPendingSubmission = latestSubmission?.status === "PENDING";
  const hasApprovedSubmission = latestSubmission?.status === "APPROVED";
  const hasRejectedSubmission = latestSubmission?.status === "REJECTED";

  const isUploadBlocked =
    isUploading || hasPendingSubmission || hasApprovedSubmission;

  const loadSubmissions = useCallback(async () => {
    setErrorMessage(null);
    setIsLoadingHistory(true);

    try {
      const response = await fetch(
        `${API_URL}/api/notification-submissions/${image.id}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      const contentType = response.headers.get("Content-Type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "Răspunsul serverului nu a fost în format JSON. Încearcă să reîncarci pagina.",
        );
      }

      const data = (await response.json()) as SubmissionsResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Istoricul dovezilor nu a putut fi încărcat.",
        );
      }

      setSubmissions(data.submissions ?? []);
    } catch (error) {
      console.error("Failed to load submission history:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Istoricul dovezilor nu a putut fi încărcat.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }, [image.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSubmissions();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadSubmissions]);

  useEffect(() => {
    if (!previewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  function resetSelectedFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const file = event.target.files?.[0];

    if (!file) {
      resetSelectedFile();
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      event.target.value = "";

      setErrorMessage("Poți încărca doar imagini JPG, JPEG, PNG sau WEBP.");

      return;
    }

    const maximumFileSize = 10 * 1024 * 1024;

    if (file.size > maximumFileSize) {
      event.target.value = "";

      setErrorMessage("Imaginea poate avea maximum 10 MB.");

      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function uploadSubmission() {
    if (!selectedFile) {
      setErrorMessage("Selectează mai întâi o imagine.");
      return;
    }

    if (isUploadBlocked) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();

      formData.append("image", selectedFile);
      formData.append("notificationImageId", String(image.id));

      const response = await fetch(
        `${API_URL}/api/notification-submissions/upload`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      const contentType = response.headers.get("Content-Type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "Răspunsul serverului nu a fost în format JSON. Încearcă să reîncarci pagina.",
        );
      }

      const data = (await response.json()) as SubmissionMutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Dovada nu a putut fi încărcată.");
      }

      resetSelectedFile();

      await loadSubmissions();

      setSuccessMessage(
        data.message ?? "Imaginea a fost încărcată și trimisă în review.",
      );
    } catch (error) {
      console.error("Failed to upload submission:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Dovada nu a putut fi încărcată.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border ${
        hasApprovedSubmission
          ? "border-green-500/40 bg-green-500/[0.06]"
          : hasRejectedSubmission
            ? "border-red-500/40 bg-red-500/[0.06]"
            : hasPendingSubmission
              ? "border-amber-500/40 bg-amber-500/[0.06]"
              : "border-white/10 bg-black/40"
      }`}
    >
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={image.image_path}
          alt={image.display_name?.trim() || `Imagine cerută ${imageNumber}`}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover"
        />

        <span className="absolute top-3 left-3 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
          Imaginea {imageNumber}
        </span>

        {hasApprovedSubmission && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-950/45">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-black shadow-2xl">
              <CheckCircle2 className="h-9 w-9" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        {image.display_name && (
          <h3 className="mb-3 font-semibold text-white">
            {image.display_name}
          </h3>
        )}

        {isLoadingHistory ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Se încarcă statusul...
          </div>
        ) : latestSubmission ? (
          <SubmissionStatus submission={latestSubmission} />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-400">
            <ImagePlus className="h-4 w-4" />
            Nu ai încărcat încă o dovadă.
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-[#B8904D]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{successMessage}</p>
          </div>
        )}

        {!hasApprovedSubmission && !hasPendingSubmission && (
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {previewUrl && selectedFile && (
              <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={previewUrl}
                    alt="Previzualizare dovadă"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/10 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {selectedFile.name}
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetSelectedFile}
                    disabled={isUploading}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Elimină
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImagePlus className="h-4 w-4" />

                {selectedFile
                  ? "Schimbă imaginea"
                  : hasRejectedSubmission
                    ? "Încarcă din nou"
                    : "Selectează dovada"}
              </button>

              <button
                type="button"
                onClick={() => void uploadSubmission()}
                disabled={!selectedFile || isUploading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isUploading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Trimite în review
              </button>
            </div>
          </div>
        )}

        {submissions.length > 1 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
            <History className="h-3.5 w-3.5" />
            {submissions.length} încercări salvate în istoric
          </div>
        )}
      </div>
    </article>
  );
}

function SubmissionStatus({
  submission,
}: {
  submission: NotificationImageSubmission;
}) {
  if (submission.status === "APPROVED") {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#B8904D]">
          <CheckCircle2 className="h-4 w-4" />
          Dovadă aprobată
        </div>

        {submission.reviewed_at && (
          <p className="mt-2 text-xs text-[#B8904D]">
            Verificată la {formatSubmissionDate(submission.reviewed_at)}
          </p>
        )}
      </div>
    );
  }

  if (submission.status === "REJECTED") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
          <XCircle className="h-4 w-4" />
          Dovadă respinsă
        </div>

        {submission.rejection_reason && (
          <p className="mt-2 text-sm leading-5 text-red-200/80">
            Motiv: {submission.rejection_reason}
          </p>
        )}

        {submission.reviewed_at && (
          <p className="mt-2 text-xs text-red-200/60">
            Verificată la {formatSubmissionDate(submission.reviewed_at)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
        <Clock3 className="h-4 w-4" />
        Dovadă în review
      </div>

      <p className="mt-2 text-xs text-amber-200/70">
        Încărcată la {formatSubmissionDate(submission.created_at)}
      </p>
    </div>
  );
}
