import { Router } from "express";

import {
  getWorkflowDiscordChannels,
  updateWorkflowDiscordChannel,
} from "../database/discord/workflowDiscord";

import { requireAdmin } from "../services/requireAdmin";

const router = Router();

router.get("/admin/channels", requireAdmin, async (_req, res) => {
  try {
    const channels = await getWorkflowDiscordChannels();

    return res.json({
      success: true,
      data: channels,
    });
  } catch (error) {
    console.error("Failed to load workflow Discord channels:", error);

    return res.status(500).json({
      success: false,
      message: "Configurarea canalelor Discord nu a putut fi încărcată.",
    });
  }
});

router.patch(
  "/admin/channels/:workflowTypeId",
  requireAdmin,
  async (req, res) => {
    try {
      const workflowTypeId = Number(req.params.workflowTypeId);

      if (!Number.isInteger(workflowTypeId) || workflowTypeId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Workflow type ID invalid.",
        });
      }

      const { discordChannelId, isEnabled } = req.body as {
        discordChannelId?: string | null;
        isEnabled?: boolean;
      };

      if (typeof isEnabled !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Statusul integrării Discord este invalid.",
        });
      }

      const normalizedChannelId =
        typeof discordChannelId === "string" ? discordChannelId.trim() : null;

      if (isEnabled && !normalizedChannelId) {
        return res.status(400).json({
          success: false,
          message:
            "Discord Channel ID este obligatoriu când integrarea este activă.",
        });
      }

      if (normalizedChannelId && !/^\d+$/.test(normalizedChannelId)) {
        return res.status(400).json({
          success: false,
          message: "Discord Channel ID trebuie să conțină doar cifre.",
        });
      }

      if (normalizedChannelId && normalizedChannelId.length > 30) {
        return res.status(400).json({
          success: false,
          message: "Discord Channel ID este prea lung.",
        });
      }

      const updatedChannel = await updateWorkflowDiscordChannel({
        workflowTypeId,
        discordChannelId: normalizedChannelId || null,
        isEnabled,
      });

      return res.json({
        success: true,
        message: "Configurarea Discord a fost actualizată.",
        data: updatedChannel,
      });
    } catch (error) {
      console.error("Failed to update workflow Discord channel:", error);

      return res.status(500).json({
        success: false,
        message: "Configurarea Discord nu a putut fi actualizată.",
      });
    }
  },
);

export default router;
