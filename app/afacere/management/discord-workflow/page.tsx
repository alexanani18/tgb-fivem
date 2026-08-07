"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AlertCircle,
  Check,
  CircleOff,
  Hash,
  RefreshCw,
  Save,
  ServerCog,
} from "lucide-react";

import AppShell from "../../../components/AppShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

interface WorkflowDiscordChannel {
  id: number;
  workflowTypeId: number;
  workflowTypeCode: string;
  workflowTypeName: string;
  requestPrefix: string;

  discordChannelId: string | null;
  isEnabled: boolean;

  createdAt: string;
  updatedAt: string;
}

interface WorkflowDiscordChannelsResponse {
  success: boolean;
  message?: string;
  data?: WorkflowDiscordChannel[];
}

interface WorkflowDiscordChannelMutationResponse {
  success: boolean;
  message?: string;
  data?: WorkflowDiscordChannel;
}

interface EditableChannel {
  discordChannelId: string;
  isEnabled: boolean;
}

function getWorkflowLabel(code: string, fallback: string): string {
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

export default function WorkflowDiscordManagementPage() {
  const [channels, setChannels] = useState<WorkflowDiscordChannel[]>([]);

  const [forms, setForms] = useState<Record<number, EditableChannel>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [savingWorkflowTypeId, setSavingWorkflowTypeId] = useState<
    number | null
  >(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadChannels = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const response = await fetch(
        `${API_URL}/workflow-discord/admin/channels`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      const data = (await response.json()) as WorkflowDiscordChannelsResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Configurarea Discord nu a putut fi încărcată.",
        );
      }

      const loadedChannels = data.data ?? [];

      setChannels(loadedChannels);

      const nextForms: Record<number, EditableChannel> = {};

      for (const channel of loadedChannels) {
        nextForms[channel.workflowTypeId] = {
          discordChannelId: channel.discordChannelId ?? "",
          isEnabled: channel.isEnabled,
        };
      }

      setForms(nextForms);
    } catch (error) {
      console.error("Failed to load workflow Discord management:", error);

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
      void loadChannels();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadChannels]);

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

  function updateForm(
    workflowTypeId: number,
    changes: Partial<EditableChannel>,
  ) {
    setForms((currentForms) => ({
      ...currentForms,

      [workflowTypeId]: {
        ...currentForms[workflowTypeId],
        ...changes,
      },
    }));
  }

  async function saveChannel(channel: WorkflowDiscordChannel) {
    const form = forms[channel.workflowTypeId];

    if (!form) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const discordChannelId = form.discordChannelId.trim();

    if (discordChannelId && !/^\d+$/.test(discordChannelId)) {
      setErrorMessage(
        `${getWorkflowLabel(
          channel.workflowTypeCode,
          channel.workflowTypeName,
        )}: Discord Channel ID trebuie să conțină doar cifre.`,
      );

      return;
    }

    if (form.isEnabled && !discordChannelId) {
      setErrorMessage(
        `${getWorkflowLabel(
          channel.workflowTypeCode,
          channel.workflowTypeName,
        )}: introdu un Discord Channel ID înainte de activarea integrării.`,
      );

      return;
    }

    setSavingWorkflowTypeId(channel.workflowTypeId);

    try {
      const response = await fetch(
        `${API_URL}/workflow-discord/admin/channels/${channel.workflowTypeId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            discordChannelId: discordChannelId || null,

            isEnabled: form.isEnabled,
          }),
        },
      );

      const data =
        (await response.json()) as WorkflowDiscordChannelMutationResponse;

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.message ?? "Configurarea nu a putut fi salvată.");
      }

      const updatedChannel = data.data;

      setChannels((currentChannels) =>
        currentChannels.map((currentChannel) =>
          currentChannel.workflowTypeId === updatedChannel.workflowTypeId
            ? updatedChannel
            : currentChannel,
        ),
      );

      setForms((currentForms) => ({
        ...currentForms,

        [updatedChannel.workflowTypeId]: {
          discordChannelId: updatedChannel.discordChannelId ?? "",
          isEnabled: updatedChannel.isEnabled,
        },
      }));

      setSuccessMessage(
        `Configurarea Discord pentru ${getWorkflowLabel(
          updatedChannel.workflowTypeCode,
          updatedChannel.workflowTypeName,
        )} a fost salvată.`,
      );
    } catch (error) {
      console.error("Failed to save workflow Discord channel:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Configurarea nu a putut fi salvată.",
      );
    } finally {
      setSavingWorkflowTypeId(null);
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
                  Control Panel · Management
                </p>

                <h1 className="mt-3 text-3xl font-bold text-white">
                  Discord - Cereri
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                  Configurează canalul Discord folosit pentru fiecare tip de
                  cerere.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadChannels(true)}
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
            ) : channels.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {channels.map((channel) => {
                  const form = forms[channel.workflowTypeId];

                  if (!form) {
                    return null;
                  }

                  const isSaving =
                    savingWorkflowTypeId === channel.workflowTypeId;

                  return (
                    <section
                      key={channel.workflowTypeId}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#B8904D]/15 text-[#B8904D]">
                            <ServerCog className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-semibold text-white">
                                {getWorkflowLabel(
                                  channel.workflowTypeCode,
                                  channel.workflowTypeName,
                                )}
                              </h2>

                              <span className="rounded-full border border-[#B8904D]/25 bg-[#B8904D]/10 px-2 py-0.5 text-[10px] font-semibold text-[#D5B477]">
                                {channel.requestPrefix}
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-zinc-500">
                              {channel.workflowTypeCode}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            form.isEnabled
                              ? "border-green-500/30 bg-green-500/10 text-green-300"
                              : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
                          }`}
                        >
                          {form.isEnabled ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <CircleOff className="h-3 w-3" />
                          )}

                          {form.isEnabled ? "Activ" : "Inactiv"}
                        </span>
                      </div>

                      <div className="mt-6 space-y-5">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-zinc-300">
                            Discord Channel ID
                          </span>

                          <div className="relative">
                            <Hash className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-zinc-500" />

                            <input
                              type="text"
                              inputMode="numeric"
                              value={form.discordChannelId}
                              onChange={(event) =>
                                updateForm(channel.workflowTypeId, {
                                  discordChannelId: event.target.value,
                                })
                              }
                              placeholder="Ex: 123456789012345678"
                              className="w-full rounded-xl border border-white/10 bg-black/50 py-3 pr-4 pl-11 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#B8904D]/60"
                            />
                          </div>

                          <p className="mt-2 text-xs leading-5 text-zinc-500">
                            ID-ul canalului în care vor fi trimise cererile noi
                            de acest tip.
                          </p>
                        </label>

                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-[#B8904D]/30 hover:bg-[#B8904D]/[0.04]">
                          <input
                            type="checkbox"
                            checked={form.isEnabled}
                            onChange={(event) =>
                              updateForm(channel.workflowTypeId, {
                                isEnabled: event.target.checked,
                              })
                            }
                            className="mt-1 h-4 w-4 shrink-0 accent-[#B8904D]"
                          />

                          <div>
                            <p className="text-sm font-medium text-white">
                              Integrare Discord activă
                            </p>

                            <p className="mt-1 text-xs leading-5 text-zinc-400">
                              Cererile noi vor fi trimise în canalul configurat.
                            </p>
                          </div>
                        </label>

                        <button
                          type="button"
                          onClick={() => void saveChannel(channel)}
                          disabled={isSaving}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#B8904D] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#C8A15F] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSaving ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Salvează configurarea
                        </button>
                      </div>
                    </section>
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

function EmptyState() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
        <ServerCog className="h-8 w-8" />
      </div>

      <h2 className="mt-5 text-xl font-semibold text-white">
        Nicio configurare Discord
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
        Configurările workflow Discord vor apărea aici după ce sunt create în
        baza de date.
      </p>
    </div>
  );
}
