"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock3,
  Edit3,
  Images,
  Mail,
  MailOpen,
  RefreshCw,
  Save,
  Send,
  Trash2,
  User,
  Users,
  X,
  Hourglass,
} from "lucide-react";

import AppShell from "../../components/AppShell";

import NotificationImages from "./components/NotificationImages";
import EmployeeNotificationImage from "./components/EmployeeNotificationImage";

import {
  EMPTY_NOTIFICATION_FORM,
  type Notification,
  type NotificationForm,
  type NotificationMutationResponse,
  type NotificationsResponse,
  type Recipient,
  type RecipientsResponse,
  type SessionResponse,
  type SessionUser,
} from "./types";

const API_URL = "http://localhost:5000";

function isNotificationRead(notification: Notification): boolean {
  return notification.is_read === 1 || notification.is_read === true;
}

function formatNotificationDate(dateValue: string): string {
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

function getNotificationTimeLeft(createdAt: string): {
  expired: boolean;
  label: string;
} {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return {
      expired: false,
      label: "Timp indisponibil",
    };
  }

  const expiresAt = createdDate.getTime() + 24 * 60 * 60 * 1000;
  const remainingMilliseconds = expiresAt - Date.now();

  if (remainingMilliseconds <= 0) {
    return {
      expired: true,
      label: "Expirată",
    };
  }

  const totalMinutes = Math.floor(remainingMilliseconds / (1000 * 60));

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    expired: false,
    label: `${hours}h ${minutes}m`,
  };
}

export default function NotificationsPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [, setTimerTick] = useState(0);

  const [form, setForm] = useState<NotificationForm>(EMPTY_NOTIFICATION_FORM);

  const [editingNotificationId, setEditingNotificationId] = useState<
    number | null
  >(null);

  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const [processingNotificationId, setProcessingNotificationId] = useState<
    number | null
  >(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isAdmin = sessionUser?.role === "ADMIN";

  const unreadCount = useMemo(
    () =>
      notifications.filter((notification) => !isNotificationRead(notification))
        .length,
    [notifications],
  );

  const loadPageData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const sessionResponse = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!sessionResponse.ok) {
        throw new Error("Sesiunea nu a putut fi verificată.");
      }

      const sessionData = (await sessionResponse.json()) as SessionResponse;
      const currentUser = sessionData.user;

      setSessionUser(currentUser);

      const notificationsRequest = fetch(`${API_URL}/api/notifications`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const recipientsRequest =
        currentUser.role === "ADMIN"
          ? fetch(`${API_URL}/api/notifications/recipients`, {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            })
          : null;

      const notificationsResponse = await notificationsRequest;

      const notificationsData =
        (await notificationsResponse.json()) as NotificationsResponse;

      if (!notificationsResponse.ok || !notificationsData.success) {
        throw new Error(
          notificationsData.message ?? "Notificările nu au putut fi încărcate.",
        );
      }

      setNotifications(notificationsData.notifications ?? []);

      if (recipientsRequest) {
        const recipientsResponse = await recipientsRequest;

        const recipientsData =
          (await recipientsResponse.json()) as RecipientsResponse;

        if (!recipientsResponse.ok || !recipientsData.success) {
          throw new Error(
            recipientsData.message ?? "Angajații nu au putut fi încărcați.",
          );
        }

        setRecipients(recipientsData.recipients ?? []);
      } else {
        setRecipients([]);
      }
    } catch (error) {
      console.error("Failed to load notifications page:", error);

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
    const intervalId = window.setInterval(() => {
      void loadPageData(true);
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimerTick((currentTick) => currentTick + 1);
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  function resetMessages() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function dispatchNotificationsUpdated() {
    window.dispatchEvent(new Event("notifications-updated"));
  }

  async function createNotification() {
    resetMessages();

    const recipientId = Number(form.recipientId);
    const title = form.title.trim();
    const message = form.message.trim();

    if (!Number.isInteger(recipientId) || recipientId <= 0) {
      setErrorMessage("Selectează un angajat.");
      return;
    }

    if (!title) {
      setErrorMessage("Titlul este obligatoriu.");
      return;
    }

    if (title.length > 150) {
      setErrorMessage("Titlul poate avea maximum 150 de caractere.");
      return;
    }

    if (!message) {
      setErrorMessage("Mesajul este obligatoriu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/notifications`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientId,
          title,
          message,
          includeImages: form.includeImages,
        }),
      });

      const data = (await response.json()) as NotificationMutationResponse;

      if (!response.ok || !data.success || !data.notification) {
        throw new Error(data.message ?? "Notificarea nu a putut fi trimisă.");
      }

      setNotifications((currentNotifications) => [
        data.notification!,
        ...currentNotifications,
      ]);

      setForm(EMPTY_NOTIFICATION_FORM);

      setSuccessMessage(
        data.message ??
          (form.includeImages
            ? "Notificarea și imaginile au fost trimise."
            : "Notificarea a fost trimisă."),
      );
    } catch (error) {
      console.error("Failed to create notification:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notificarea nu a putut fi trimisă.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function beginEditing(notification: Notification) {
    resetMessages();

    setEditingNotificationId(notification.id);
    setEditTitle(notification.title);
    setEditMessage(notification.message);
  }

  function cancelEditing() {
    setEditingNotificationId(null);
    setEditTitle("");
    setEditMessage("");
  }

  async function updateNotification(notificationId: number) {
    resetMessages();

    const title = editTitle.trim();
    const message = editMessage.trim();

    if (!title) {
      setErrorMessage("Titlul este obligatoriu.");
      return;
    }

    if (title.length > 150) {
      setErrorMessage("Titlul poate avea maximum 150 de caractere.");
      return;
    }

    if (!message) {
      setErrorMessage("Mesajul este obligatoriu.");
      return;
    }

    setProcessingNotificationId(notificationId);

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/${notificationId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            message,
          }),
        },
      );

      const data = (await response.json()) as NotificationMutationResponse;

      if (!response.ok || !data.success || !data.notification) {
        throw new Error(
          data.message ?? "Notificarea nu a putut fi actualizată.",
        );
      }

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification.id === notificationId
            ? data.notification!
            : notification,
        ),
      );

      cancelEditing();
      setSuccessMessage("Notificarea a fost actualizată.");
    } catch (error) {
      console.error("Failed to update notification:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notificarea nu a putut fi actualizată.",
      );
    } finally {
      setProcessingNotificationId(null);
    }
  }

  async function deleteNotification(notificationId: number) {
    const confirmed = window.confirm(
      "Ești sigur că vrei să ștergi această notificare?",
    );

    if (!confirmed) {
      return;
    }

    resetMessages();
    setProcessingNotificationId(notificationId);

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/${notificationId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = (await response.json()) as NotificationMutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Notificarea nu a putut fi ștearsă.");
      }

      setNotifications((currentNotifications) =>
        currentNotifications.filter(
          (notification) => notification.id !== notificationId,
        ),
      );

      setSuccessMessage("Notificarea a fost ștearsă.");
    } catch (error) {
      console.error("Failed to delete notification:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notificarea nu a putut fi ștearsă.",
      );
    } finally {
      setProcessingNotificationId(null);
    }
  }

  async function markNotificationAsRead(notification: Notification) {
    if (isNotificationRead(notification)) {
      return;
    }

    resetMessages();
    setProcessingNotificationId(notification.id);

    try {
      const response = await fetch(
        `${API_URL}/api/notifications/${notification.id}/read`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const data = (await response.json()) as NotificationMutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Notificarea nu a putut fi marcată drept citită.",
        );
      }

      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) =>
          currentNotification.id === notification.id
            ? {
                ...currentNotification,
                is_read: 1,
              }
            : currentNotification,
        ),
      );

      dispatchNotificationsUpdated();
      setSuccessMessage("Notificarea a fost marcată drept citită.");
    } catch (error) {
      console.error("Failed to mark notification as read:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notificarea nu a putut fi actualizată.",
      );
    } finally {
      setProcessingNotificationId(null);
    }
  }

  async function markAllNotificationsAsRead() {
    if (unreadCount === 0) {
      return;
    }

    resetMessages();
    setIsMarkingAll(true);

    try {
      const response = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PATCH",
        credentials: "include",
      });

      const data = (await response.json()) as NotificationMutationResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Notificările nu au putut fi marcate drept citite.",
        );
      }

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          is_read: 1,
        })),
      );

      dispatchNotificationsUpdated();

      setSuccessMessage(
        data.updatedCount === 1
          ? "O notificare a fost marcată drept citită."
          : `${data.updatedCount ?? unreadCount} notificări au fost marcate drept citite.`,
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notificările nu au putut fi actualizate.",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  return (
    <AppShell backgroundImage="/img/business-image.png">
      <div className="mx-auto w-full max-w-7xl p-5 md:p-8">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/45 shadow-2xl backdrop-blur-md">
          <header className="border-b border-white/10 p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm tracking-[0.2em] text-green-500 uppercase">
                  Afacere
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">Notificări</h1>

                  {!isAdmin && unreadCount > 0 && (
                    <span className="rounded-full border border-green-400/30 bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-300">
                      {unreadCount} necitite
                    </span>
                  )}
                </div>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                  {isAdmin
                    ? "Trimite mesaje individuale angajaților, cu sau fără imagini."
                    : "Aici sunt afișate mesajele și imaginile trimise direct către contul tău."}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void loadPageData(true)}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  Reîncarcă
                </button>

                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsAsRead()}
                    disabled={isMarkingAll || unreadCount === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isMarkingAll ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4" />
                    )}
                    Marchează toate ca citite
                  </button>
                )}
              </div>
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
              <div className="flex min-h-[350px] items-center justify-center">
                <RefreshCw className="h-10 w-10 animate-spin text-green-500" />
              </div>
            ) : isAdmin ? (
              <AdminNotifications
                form={form}
                setForm={setForm}
                recipients={recipients}
                notifications={notifications}
                isSubmitting={isSubmitting}
                processingNotificationId={processingNotificationId}
                editingNotificationId={editingNotificationId}
                editTitle={editTitle}
                editMessage={editMessage}
                setEditTitle={setEditTitle}
                setEditMessage={setEditMessage}
                createNotification={createNotification}
                beginEditing={beginEditing}
                cancelEditing={cancelEditing}
                updateNotification={updateNotification}
                deleteNotification={deleteNotification}
              />
            ) : notifications.length === 0 ? (
              <EmptyNotifications icon={<Mail className="h-8 w-8" />} />
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => {
                  const isRead = isNotificationRead(notification);

                  const isProcessing =
                    processingNotificationId === notification.id;

                  return (
                    <EmployeeNotificationCard
                      key={notification.id}
                      notification={notification}
                      isRead={isRead}
                      isProcessing={isProcessing}
                      markNotificationAsRead={markNotificationAsRead}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

interface AdminNotificationsProps {
  form: NotificationForm;
  setForm: React.Dispatch<React.SetStateAction<NotificationForm>>;
  recipients: Recipient[];
  notifications: Notification[];
  isSubmitting: boolean;
  processingNotificationId: number | null;
  editingNotificationId: number | null;
  editTitle: string;
  editMessage: string;
  setEditTitle: React.Dispatch<React.SetStateAction<string>>;
  setEditMessage: React.Dispatch<React.SetStateAction<string>>;
  createNotification: () => Promise<void>;
  beginEditing: (notification: Notification) => void;
  cancelEditing: () => void;
  updateNotification: (notificationId: number) => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
}

function AdminNotifications({
  form,
  setForm,
  recipients,
  notifications,
  isSubmitting,
  processingNotificationId,
  editingNotificationId,
  editTitle,
  editMessage,
  setEditTitle,
  setEditMessage,
  createNotification,
  beginEditing,
  cancelEditing,
  updateNotification,
  deleteNotification,
}: AdminNotificationsProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/15 text-green-400">
            <Send className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-semibold text-white">Notificare nouă</h2>

            <p className="text-xs text-zinc-400">
              Mesaj privat către un angajat
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Angajat
            </span>

            <select
              value={form.recipientId}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  recipientId: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:border-green-500/50"
            >
              <option value="">Selectează angajatul</option>

              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.username} — {recipient.user_role}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Titlu
            </span>

            <input
              type="text"
              value={form.title}
              maxLength={150}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  title: event.target.value,
                }))
              }
              placeholder="Ex: Verificare locații"
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500/50"
            />

            <p className="mt-1 text-right text-xs text-zinc-500">
              {form.title.length}/150
            </p>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Mesaj
            </span>

            <textarea
              value={form.message}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  message: event.target.value,
                }))
              }
              placeholder="Scrie mesajul pentru angajat..."
              rows={7}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-green-500/50"
            />
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-green-500/30 hover:bg-green-500/[0.04]">
            <input
              type="checkbox"
              checked={form.includeImages}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  includeImages: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 shrink-0 accent-green-500"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Images className="h-4 w-4 text-green-400" />

                <p className="text-sm font-medium text-white">
                  Trimite și 4 imagini
                </p>
              </div>

              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Sistemul va selecta aleatoriu 4 imagini diferite. Selecția
                rămâne asociată notificării.
              </p>
            </div>
          </label>

          <button
            type="button"
            onClick={() => void createNotification()}
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Trimite notificarea
          </button>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">
            Notificări trimise
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            {notifications.length} notificări create de tine
          </p>
        </div>

        {notifications.length === 0 ? (
          <EmptyNotifications admin icon={<Users className="h-8 w-8" />} />
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const isEditing = editingNotificationId === notification.id;

              const isProcessing = processingNotificationId === notification.id;

              return (
                <article
                  key={notification.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <input
                        type="text"
                        value={editTitle}
                        maxLength={150}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-green-500/50"
                      />

                      <textarea
                        value={editMessage}
                        onChange={(event) => setEditMessage(event.target.value)}
                        rows={6}
                        className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-green-500/50"
                      />

                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                        >
                          <X className="h-4 w-4" />
                          Anulează
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void updateNotification(notification.id)
                          }
                          disabled={isProcessing}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-3 py-2 text-sm font-semibold text-black hover:bg-green-400 disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Salvează
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">
                              {notification.title}
                            </h3>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                isNotificationRead(notification)
                                  ? "bg-white/10 text-zinc-300"
                                  : "bg-amber-500/15 text-amber-300"
                              }`}
                            >
                              {isNotificationRead(notification)
                                ? "Citită"
                                : "Necitită"}
                            </span>

                            {(notification.images?.length ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-semibold text-green-300">
                                <Images className="h-3 w-3" />
                                {notification.images?.length} imagini
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-400">
                            <span className="inline-flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              Către{" "}
                              <strong className="text-zinc-300">
                                {notification.recipient_username}
                              </strong>
                            </span>

                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />

                              {formatNotificationDate(notification.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => beginEditing(notification)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                            aria-label="Editează notificarea"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteNotification(notification.id)
                            }
                            disabled={isProcessing}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                            aria-label="Șterge notificarea"
                          >
                            {isProcessing ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-zinc-200">
                        {notification.message}
                      </p>

                      <NotificationImages images={notification.images ?? []} />

                      {notification.updated_at !== notification.created_at && (
                        <p className="mt-4 text-xs italic text-zinc-500">
                          Actualizată la{" "}
                          {formatNotificationDate(notification.updated_at)}
                        </p>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

interface EmployeeNotificationCardProps {
  notification: Notification;
  isRead: boolean;
  isProcessing: boolean;
  markNotificationAsRead: (notification: Notification) => Promise<void>;
}

function EmployeeNotificationCard({
  notification,
  isRead,
  isProcessing,
  markNotificationAsRead,
}: EmployeeNotificationCardProps) {
  const hasImages = (notification.images?.length ?? 0) > 0;

  const timeLeft = hasImages
    ? getNotificationTimeLeft(notification.created_at)
    : null;
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-5 transition md:p-6 ${
        isRead
          ? "border-white/10 bg-white/[0.04]"
          : "border-green-500/30 bg-green-500/[0.08]"
      }`}
    >
      {!isRead && (
        <div className="absolute inset-y-0 left-0 w-1 bg-green-500" />
      )}

      <div className="flex flex-col gap-5 sm:flex-row">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            isRead
              ? "bg-white/5 text-zinc-400"
              : "bg-green-500/15 text-green-400"
          }`}
        >
          {isRead ? (
            <MailOpen className="h-6 w-6" />
          ) : (
            <Mail className="h-6 w-6" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-white">
                  {notification.title}
                </h2>

                {!isRead && (
                  <span className="rounded-full bg-green-500 px-2.5 py-1 text-[11px] font-bold text-black uppercase">
                    Nou
                  </span>
                )}

                {(notification.images?.length ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                    <Images className="h-3 w-3" />
                    {notification.images?.length} imagini
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-5 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Trimis de{" "}
                  <strong className="text-zinc-300">
                    {notification.creator_username ?? "Administrator"}
                  </strong>
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatNotificationDate(notification.created_at)}
                </span>

                {timeLeft && (
                  <span
                    className={`inline-flex items-center gap-1.5 font-medium ${
                      timeLeft.expired ? "text-red-400" : "text-amber-300"
                    }`}
                  >
                    <Hourglass className="h-3.5 w-3.5" />

                    {timeLeft.expired
                      ? "Notificare expirată"
                      : `Timp rămas: ${timeLeft.label}`}
                  </span>
                )}
              </div>
            </div>

            {!isRead && (
              <button
                type="button"
                onClick={() => void markNotificationAsRead(notification)}
                disabled={isProcessing}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 transition hover:bg-green-500/20 disabled:opacity-50"
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Marchează ca citită
              </button>
            )}
          </div>

          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-zinc-200">
            {notification.message}
          </p>

          <EmployeeNotificationImages images={notification.images ?? []} />

          {notification.updated_at !== notification.created_at && (
            <p className="mt-4 text-xs italic text-zinc-500">
              Mesaj actualizat la{" "}
              {formatNotificationDate(notification.updated_at)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function EmployeeNotificationImages({
  images,
}: {
  images: Notification["images"];
}) {
  if (!images || images.length === 0) {
    return null;
  }

  const sortedImages = [...images].sort(
    (firstImage, secondImage) => firstImage.position - secondImage.position,
  );

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-white">
            <Images className="h-4 w-4 text-green-400" />
            Imagini de verificat
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            Încarcă o dovadă separată pentru fiecare imagine.
          </p>
        </div>

        <span className="text-xs text-zinc-500">
          {sortedImages.length} imagini
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {sortedImages.map((image, index) => (
          <EmployeeNotificationImage
            key={image.id}
            image={image}
            imageNumber={index + 1}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyNotifications({
  admin = false,
  icon,
}: {
  admin?: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
        {icon}
      </div>

      <h2 className="mt-5 text-xl font-semibold text-white">
        {admin ? "Nu ai trimis notificări" : "Nu ai notificări"}
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
        {admin
          ? "Folosește formularul pentru a trimite primul mesaj unui angajat."
          : "Mesajele trimise de administrator către tine vor apărea aici."}
      </p>
    </div>
  );
}
