import { EmbedBuilder } from "discord.js";

import {
  getWorkflowDiscordActorName,
  getWorkflowDiscordChannelByTypeCode,
  getWorkflowDiscordMessage,
  getWorkflowDiscordRequestSnapshot,
  saveWorkflowDiscordMessage,
  type WorkflowDiscordMessage,
  type WorkflowDiscordRequestSnapshot,
} from "../database/discord/workflowDiscord";

import { discordClient, startDiscordClient } from "./client";

/*
|--------------------------------------------------------------------------
| Prepared delete - employee
|--------------------------------------------------------------------------
*/

export async function prepareWorkflowDiscordMessageDelete(
  workflowRequestId: number,
): Promise<WorkflowDiscordMessage | null> {
  return getWorkflowDiscordMessage(workflowRequestId);
}

export async function deletePreparedWorkflowDiscordMessageSafe(
  savedMessage: WorkflowDiscordMessage | null,
): Promise<void> {
  if (!savedMessage) {
    return;
  }

  try {
    const message = await getSavedDiscordMessage(savedMessage);

    await message.delete();
  } catch (error) {
    console.warn(
      `⚠️ Prepared Discord workflow message delete failed for request ${savedMessage.workflowRequestId}.`,
    );

    console.warn(error);
  }
}

/*
|--------------------------------------------------------------------------
| Prepared delete - admin
|--------------------------------------------------------------------------
*/

export interface PrepareWorkflowDiscordAdminDeleteResult {
  request: WorkflowDiscordRequestSnapshot;
  message: WorkflowDiscordMessage | null;
  deletedByName: string;
  deletedAt: Date;
}

export async function prepareWorkflowDiscordAdminDelete(
  workflowRequestId: number,
  adminId: number,
): Promise<PrepareWorkflowDiscordAdminDeleteResult | null> {
  const request = await getWorkflowDiscordRequestSnapshot(workflowRequestId);

  if (!request) {
    return null;
  }

  const [message, deletedByName] = await Promise.all([
    getWorkflowDiscordMessage(workflowRequestId),
    getWorkflowDiscordActorName(adminId),
  ]);

  return {
    request,
    message,
    deletedByName,
    deletedAt: new Date(),
  };
}

export async function markWorkflowDiscordMessageDeletedByAdmin(
  prepared: PrepareWorkflowDiscordAdminDeleteResult,
): Promise<void> {
  if (!prepared.message) {
    return;
  }

  const message = await getSavedDiscordMessage(prepared.message);

  const embed = buildDeletedWorkflowEmbed(
    prepared.request,
    prepared.deletedByName,
    prepared.deletedAt,
  );

  await message.edit({
    embeds: [embed],
  });
}

export async function markWorkflowDiscordMessageDeletedByAdminSafe(
  prepared: PrepareWorkflowDiscordAdminDeleteResult | null,
): Promise<void> {
  if (!prepared) {
    return;
  }

  try {
    await markWorkflowDiscordMessageDeletedByAdmin(prepared);
  } catch (error) {
    console.warn(
      `⚠️ Discord workflow admin-delete update failed for request ${prepared.request.workflowRequestId}.`,
    );

    console.warn(error);
  }
}

/*
|--------------------------------------------------------------------------
| Date helpers
|--------------------------------------------------------------------------
*/

function formatDiscordDate(value: string | Date | null): string {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateOnly(value: string | Date | null): string {
  if (!value) {
    return "—";
  }

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else {
    const normalizedValue = value.includes("T") ? value.slice(0, 10) : value;

    date = new Date(`${normalizedValue}T00:00:00`);
  }

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatEffectiveDate(value: string | Date | null): string {
  return formatDateOnly(value);
}

function parseDateOnly(value: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

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

function getLeaveDuration(
  startDate: string | Date | null,
  endDate: string | Date | null,
): number | null {
  const start = parseDateOnly(startDate);

  const end = parseDateOnly(endDate);

  if (!start || !end || end < start) {
    return null;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}

/*
|--------------------------------------------------------------------------
| RESIGNATION
|--------------------------------------------------------------------------
*/

function buildResignationEmbed(request: WorkflowDiscordRequestSnapshot) {
  const isRejected = request.statusCode === "REJECTED";

  const isApproved = request.statusCode === "APPROVED";

  const isCompleted = Boolean(request.completedAt);

  const embedColor = isRejected ? 0xef4444 : isCompleted ? 0x22c55e : 0xb8904d;

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${request.requestNumber} · Cerere de demisie`)
    .addFields(
      {
        name: "👤 Angajat",
        value: request.employeeName,
        inline: true,
      },
      {
        name: "📅 Data solicitată",
        value: formatEffectiveDate(request.effectiveDate),
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "📝 Motiv",
        value: request.reason?.trim() || "Motiv indisponibil.",
        inline: false,
      },
    );

  if (isRejected) {
    embed.addFields(
      {
        name: "❌ Status",
        value: "**Cerere respinsă**",
        inline: true,
      },
      {
        name: "👤 Respinsă de",
        value: request.reviewedByName ?? "Administrator",
        inline: true,
      },
      {
        name: "📅 Data respingerii",
        value: request.reviewedAt ? formatDiscordDate(request.reviewedAt) : "—",
        inline: true,
      },
    );
  } else {
    const approvalStatus = isApproved ? "**Aprobată**" : "**În așteptare**";

    const uniformStatus = request.uniformReturned
      ? "**Predată**"
      : isApproved
        ? "**Nepredată**"
        : "**În așteptare**";

    const completionStatus = isCompleted
      ? "**Finalizată**"
      : "**În așteptare**";

    embed.addFields(
      {
        name: isApproved ? "✅ Cerere" : "⏳ Cerere",
        value: approvalStatus,
        inline: true,
      },
      {
        name: request.uniformReturned
          ? "✅ Uniformă"
          : isApproved
            ? "⏳ Uniformă"
            : "▫️ Uniformă",
        value: uniformStatus,
        inline: true,
      },
      {
        name: isCompleted
          ? "✅ Finalizare"
          : request.uniformReturned
            ? "⏳ Finalizare"
            : "▫️ Finalizare",
        value: completionStatus,
        inline: true,
      },
    );

    if (request.reviewedByName && request.reviewedAt) {
      embed.addFields({
        name: "🛡️ Aprobată de",
        value: [
          `**${request.reviewedByName}**`,
          formatDiscordDate(request.reviewedAt),
        ].join("\n"),
        inline: false,
      });
    }
  }

  embed
    .setFooter({
      text: `THE BLACKFOLD SKATEHOUSE  •  ` + request.requestNumber,
    })
    .setTimestamp();

  return embed;
}

/*
|--------------------------------------------------------------------------
| LEAVE
|--------------------------------------------------------------------------
*/

function buildLeaveEmbed(request: WorkflowDiscordRequestSnapshot) {
  const isPending = request.statusCode === "PENDING";

  const isApproved = request.statusCode === "APPROVED";

  const isRejected = request.statusCode === "REJECTED";

  const embedColor = isRejected ? 0xef4444 : isApproved ? 0x22c55e : 0xb8904d;

  const duration = getLeaveDuration(
    request.leaveStartDate,
    request.leaveEndDate,
  );

  const durationLabel =
    duration === null ? "—" : `${duration} ${duration === 1 ? "zi" : "zile"}`;

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${request.requestNumber} · Cerere de concediu`)
    .addFields(
      {
        name: "👤 Angajat",
        value: request.employeeName,
        inline: true,
      },
      {
        name: "📅 De la",
        value: formatDateOnly(request.leaveStartDate),
        inline: true,
      },
      {
        name: "📅 Până la",
        value: formatDateOnly(request.leaveEndDate),
        inline: true,
      },
      {
        name: "⏱️ Durată",
        value: durationLabel,
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "📝 Motiv",
        value: request.reason?.trim() || "Motiv indisponibil.",
        inline: false,
      },
    );

  if (isPending) {
    embed.addFields({
      name: "⏳ Status",
      value: "**În așteptarea aprobării**",
      inline: false,
    });
  }

  if (isApproved) {
    embed.addFields({
      name: "✅ Status",
      value: "**Cerere aprobată**",
      inline: true,
    });

    if (request.reviewedByName && request.reviewedAt) {
      embed.addFields(
        {
          name: "🛡️ Aprobată de",
          value: `**${request.reviewedByName}**`,
          inline: true,
        },
        {
          name: "📅 Data aprobării",
          value: formatDiscordDate(request.reviewedAt),
          inline: true,
        },
      );
    }
  }

  if (isRejected) {
    embed.addFields(
      {
        name: "❌ Status",
        value: "**Cerere respinsă**",
        inline: true,
      },
      {
        name: "👤 Respinsă de",
        value: request.reviewedByName ?? "Administrator",
        inline: true,
      },
      {
        name: "📅 Data respingerii",
        value: request.reviewedAt ? formatDiscordDate(request.reviewedAt) : "—",
        inline: true,
      },
    );
  }

  embed
    .setFooter({
      text: `THE BLACKFOLD SKATEHOUSE  •  ` + request.requestNumber,
    })
    .setTimestamp();

  return embed;
}

/*
|--------------------------------------------------------------------------
| INACTIVITY
|--------------------------------------------------------------------------
*/

function buildInactivityEmbed(request: WorkflowDiscordRequestSnapshot) {
  const isPending = request.statusCode === "PENDING";

  const isApproved = request.statusCode === "APPROVED";

  const isRejected = request.statusCode === "REJECTED";

  const embedColor = isRejected ? 0xef4444 : isApproved ? 0x22c55e : 0xb8904d;

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`${request.requestNumber} · Cerere de inactivitate`)
    .addFields(
      {
        name: "👤 Angajat",
        value: request.employeeName,
        inline: true,
      },
      {
        name: "🎯 Activitate",
        value: request.activity?.trim() || "Activitate indisponibilă.",
        inline: true,
      },
      {
        name: "📅 Data activității",
        value: formatDateOnly(request.activityDate),
        inline: true,
      },
      {
        name: "📝 Motiv",
        value: request.reason?.trim() || "Motiv indisponibil.",
        inline: false,
      },
    );

  if (isPending) {
    embed.addFields({
      name: "⏳ Status",
      value: "**În așteptarea aprobării**",
      inline: false,
    });
  }

  if (isApproved) {
    embed.addFields({
      name: "✅ Status",
      value: "**Cerere aprobată**",
      inline: true,
    });

    if (request.reviewedByName && request.reviewedAt) {
      embed.addFields(
        {
          name: "🛡️ Aprobată de",
          value: `**${request.reviewedByName}**`,
          inline: true,
        },
        {
          name: "📅 Data aprobării",
          value: formatDiscordDate(request.reviewedAt),
          inline: true,
        },
      );
    }
  }

  if (isRejected) {
    embed.addFields(
      {
        name: "❌ Status",
        value: "**Cerere respinsă**",
        inline: true,
      },
      {
        name: "👤 Respinsă de",
        value: request.reviewedByName ?? "Administrator",
        inline: true,
      },
      {
        name: "📅 Data respingerii",
        value: request.reviewedAt ? formatDiscordDate(request.reviewedAt) : "—",
        inline: true,
      },
    );
  }

  embed
    .setFooter({
      text: `THE BLACKFOLD SKATEHOUSE  •  ` + request.requestNumber,
    })
    .setTimestamp();

  return embed;
}

/*
|--------------------------------------------------------------------------
| Deleted LEAVE
|--------------------------------------------------------------------------
*/

function buildDeletedLeaveEmbed(
  request: WorkflowDiscordRequestSnapshot,
  deletedByName: string,
  deletedAt: Date,
) {
  const duration = getLeaveDuration(
    request.leaveStartDate,
    request.leaveEndDate,
  );

  const durationLabel =
    duration === null ? "—" : `${duration} ${duration === 1 ? "zi" : "zile"}`;

  return new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle(`${request.requestNumber} · Cerere de concediu`)
    .addFields(
      {
        name: "👤 Angajat",
        value: request.employeeName,
        inline: true,
      },
      {
        name: "📅 De la",
        value: formatDateOnly(request.leaveStartDate),
        inline: true,
      },
      {
        name: "📅 Până la",
        value: formatDateOnly(request.leaveEndDate),
        inline: true,
      },
      {
        name: "⏱️ Durată",
        value: durationLabel,
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "\u200B",
        value: "\u200B",
        inline: true,
      },
      {
        name: "📝 Motiv",
        value: request.reason?.trim() || "Motiv indisponibil.",
        inline: false,
      },
      {
        name: "🗑️ Status",
        value: "**Șters**",
        inline: true,
      },
      {
        name: "👤 Șters de",
        value: `**${deletedByName}**`,
        inline: true,
      },
      {
        name: "📅 Data ștergerii",
        value: formatDiscordDate(deletedAt),
        inline: true,
      },
    )
    .setFooter({
      text: `THE BLACKFOLD SKATEHOUSE  •  ` + request.requestNumber,
    })
    .setTimestamp(deletedAt);
}

/*
|--------------------------------------------------------------------------
| Deleted INACTIVITY
|--------------------------------------------------------------------------
*/

function buildDeletedInactivityEmbed(
  request: WorkflowDiscordRequestSnapshot,
  deletedByName: string,
  deletedAt: Date,
) {
  return new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle(`${request.requestNumber} · Cerere de inactivitate`)
    .addFields(
      {
        name: "👤 Angajat",
        value: request.employeeName,
        inline: true,
      },
      {
        name: "🎯 Activitate",
        value: request.activity?.trim() || "Activitate indisponibilă.",
        inline: true,
      },
      {
        name: "📅 Data activității",
        value: formatDateOnly(request.activityDate),
        inline: true,
      },
      {
        name: "📝 Motiv",
        value: request.reason?.trim() || "Motiv indisponibil.",
        inline: false,
      },
      {
        name: "🗑️ Status",
        value: "**Șters**",
        inline: true,
      },
      {
        name: "👤 Șters de",
        value: `**${deletedByName}**`,
        inline: true,
      },
      {
        name: "📅 Data ștergerii",
        value: formatDiscordDate(deletedAt),
        inline: true,
      },
    )
    .setFooter({
      text: `THE BLACKFOLD SKATEHOUSE  •  ` + request.requestNumber,
    })
    .setTimestamp(deletedAt);
}

/*
|--------------------------------------------------------------------------
| Deleted workflow resolver
|--------------------------------------------------------------------------
*/

function buildDeletedWorkflowEmbed(
  request: WorkflowDiscordRequestSnapshot,
  deletedByName: string,
  deletedAt: Date,
) {
  switch (request.workflowTypeCode) {
    case "LEAVE":
      return buildDeletedLeaveEmbed(request, deletedByName, deletedAt);

    case "INACTIVITY":
      return buildDeletedInactivityEmbed(request, deletedByName, deletedAt);

    default:
      throw new Error(
        `Discord deleted workflow type ${request.workflowTypeCode} is not implemented.`,
      );
  }
}

/*
|--------------------------------------------------------------------------
| Workflow embed resolver
|--------------------------------------------------------------------------
*/

function buildWorkflowEmbed(request: WorkflowDiscordRequestSnapshot) {
  switch (request.workflowTypeCode) {
    case "RESIGNATION":
      return buildResignationEmbed(request);

    case "LEAVE":
      return buildLeaveEmbed(request);

    case "INACTIVITY":
      return buildInactivityEmbed(request);

    default:
      throw new Error(
        `Discord workflow type ${request.workflowTypeCode} is not implemented.`,
      );
  }
}

/*
|--------------------------------------------------------------------------
| Discord workflow synchronization
|--------------------------------------------------------------------------
*/

export async function syncWorkflowDiscordMessage(
  workflowRequestId: number,
): Promise<void> {
  const request = await getWorkflowDiscordRequestSnapshot(workflowRequestId);

  if (!request) {
    throw new Error("Workflow request was not found for Discord sync.");
  }

  await startDiscordClient();

  const existingMessage = await getWorkflowDiscordMessage(workflowRequestId);

  const embed = buildWorkflowEmbed(request);

  /*
   * Dacă mesajul există deja, îl actualizăm
   * în canalul ORIGINAL.
   *
   * Dacă adminul schimbă ulterior canalul configurat,
   * cererea veche rămâne legată de mesajul inițial.
   */
  if (existingMessage) {
    const channel = await discordClient.channels.fetch(
      existingMessage.discordChannelId,
    );

    if (!channel || !channel.isSendable()) {
      throw new Error("The saved Discord channel is not sendable.");
    }

    const message = await channel.messages.fetch(
      existingMessage.discordMessageId,
    );

    await message.edit({
      embeds: [embed],
    });

    return;
  }

  /*
   * Pentru mesajele NOI folosim configurarea
   * actuală a workflow-ului.
   */
  const configuration = await getWorkflowDiscordChannelByTypeCode(
    request.workflowTypeCode,
  );

  if (
    !configuration ||
    !configuration.isEnabled ||
    !configuration.discordChannelId
  ) {
    return;
  }

  const channel = await discordClient.channels.fetch(
    configuration.discordChannelId,
  );

  if (!channel || !channel.isSendable()) {
    throw new Error(
      `Discord channel ${configuration.discordChannelId} is not sendable.`,
    );
  }

  const message = await channel.send({
    embeds: [embed],
  });

  await saveWorkflowDiscordMessage({
    workflowRequestId,
    discordChannelId: configuration.discordChannelId,
    discordMessageId: message.id,
  });
}

/*
|--------------------------------------------------------------------------
| Load saved Discord message
|--------------------------------------------------------------------------
*/

async function getSavedDiscordMessage(savedMessage: WorkflowDiscordMessage) {
  await startDiscordClient();

  const channel = await discordClient.channels.fetch(
    savedMessage.discordChannelId,
  );

  if (!channel || !channel.isSendable()) {
    throw new Error(
      `Discord channel ${savedMessage.discordChannelId} is not sendable.`,
    );
  }

  return channel.messages.fetch(savedMessage.discordMessageId);
}

/*
|--------------------------------------------------------------------------
| Delete Discord message
|--------------------------------------------------------------------------
*/

export async function deleteWorkflowDiscordMessage(
  workflowRequestId: number,
): Promise<void> {
  const savedMessage = await getWorkflowDiscordMessage(workflowRequestId);

  if (!savedMessage) {
    return;
  }

  const message = await getSavedDiscordMessage(savedMessage);

  await message.delete();
}

export async function deleteWorkflowDiscordMessageSafe(
  workflowRequestId: number,
): Promise<void> {
  try {
    await deleteWorkflowDiscordMessage(workflowRequestId);
  } catch (error) {
    console.warn(
      `⚠️ Discord workflow message delete failed for request ${workflowRequestId}.`,
    );

    console.warn(error);
  }
}

/*
|--------------------------------------------------------------------------
| Safe sync
|--------------------------------------------------------------------------
*/

export async function syncWorkflowDiscordMessageSafe(
  workflowRequestId: number,
): Promise<void> {
  try {
    await syncWorkflowDiscordMessage(workflowRequestId);
  } catch (error) {
    console.warn(
      `⚠️ Discord workflow sync failed for request ${workflowRequestId}.`,
    );

    console.warn(error);
  }
}
