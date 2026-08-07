import { EmbedBuilder } from "discord.js";

import {
  getWorkflowDiscordChannelByTypeCode,
  getWorkflowDiscordMessage,
  getWorkflowDiscordRequestSnapshot,
  saveWorkflowDiscordMessage,
  type WorkflowDiscordRequestSnapshot,
} from "../database/discord/workflowDiscord";

import { discordClient, startDiscordClient } from "./client";

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

function formatEffectiveDate(value: string | Date | null): string {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

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
      text: `THE BLACKFOLD SKATEHOUSE  •  ${request.requestNumber}`,
    })
    .setTimestamp();

  return embed;
}

function buildWorkflowEmbed(request: WorkflowDiscordRequestSnapshot) {
  switch (request.workflowTypeCode) {
    case "RESIGNATION":
      return buildResignationEmbed(request);

    default:
      throw new Error(
        `Discord workflow type ${request.workflowTypeCode} is not implemented.`,
      );
  }
}

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
