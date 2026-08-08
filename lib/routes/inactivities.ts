import { Router } from "express";

import {
  approveInactivityRequest,
  createInactivityRequest,
  deleteInactivityRequest,
  deleteOwnPendingInactivityRequest,
  getAllInactivityRequests,
  getInactivityByWorkflowId,
  getInactivityRequestsForUser,
  rejectInactivityRequest,
} from "../database/inactivityRequests";

import {
  deletePreparedWorkflowDiscordMessageSafe,
  markWorkflowDiscordMessageDeletedByAdminSafe,
  prepareWorkflowDiscordAdminDelete,
  prepareWorkflowDiscordMessageDelete,
  syncWorkflowDiscordMessageSafe,
} from "../discord/workflowMessages";

import { requireAdmin } from "../services/requireAdmin";
import { requireAuth } from "../services/requireAuth";

const router = Router();

/*
|--------------------------------------------------------------------------
| Employee - Create inactivity request
|--------------------------------------------------------------------------
*/

router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const { activity, activityDate, reason } = req.body as {
      activity?: string;
      activityDate?: string;
      reason?: string;
    };

    if (!activity || typeof activity !== "string") {
      return res.status(400).json({
        success: false,
        message: "Activitatea este obligatorie.",
      });
    }

    if (!activityDate || typeof activityDate !== "string") {
      return res.status(400).json({
        success: false,
        message: "Data activității este obligatorie.",
      });
    }

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({
        success: false,
        message: "Motivul este obligatoriu.",
      });
    }

    const inactivity = await createInactivityRequest({
      userId,
      activity,
      activityDate,
      reason,
    });

    void syncWorkflowDiscordMessageSafe(inactivity.workflow.id);

    return res.status(201).json({
      success: true,
      message: "Cererea de inactivitate a fost trimisă.",
      data: inactivity,
    });
  } catch (error) {
    console.error("Failed to create inactivity request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Cererea de inactivitate nu a putut fi creată.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Employee - Own inactivity requests
|--------------------------------------------------------------------------
*/

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const inactivityRequests = await getInactivityRequestsForUser(userId);

    return res.json({
      success: true,
      data: inactivityRequests,
    });
  } catch (error) {
    console.error("Failed to load user inactivity requests:", error);

    return res.status(500).json({
      success: false,
      message: "Cererile de inactivitate nu au putut fi încărcate.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - All inactivity requests
|--------------------------------------------------------------------------
*/

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const inactivityRequests = await getAllInactivityRequests();

    return res.json({
      success: true,
      data: inactivityRequests,
    });
  } catch (error) {
    console.error("Failed to load admin inactivity requests:", error);

    return res.status(500).json({
      success: false,
      message: "Cererile de inactivitate nu au putut fi încărcate.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Employee/Admin - Inactivity details
|--------------------------------------------------------------------------
*/

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const workflowRequestId = Number(req.params.id);

    if (!Number.isInteger(workflowRequestId) || workflowRequestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul cererii este invalid.",
      });
    }

    const inactivity = await getInactivityByWorkflowId(workflowRequestId);

    if (!inactivity) {
      return res.status(404).json({
        success: false,
        message: "Cererea de inactivitate nu a fost găsită.",
      });
    }

    return res.json({
      success: true,
      data: inactivity,
    });
  } catch (error) {
    console.error("Failed to load inactivity request:", error);

    return res.status(500).json({
      success: false,
      message: "Cererea de inactivitate nu a putut fi încărcată.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Approve inactivity request
|--------------------------------------------------------------------------
*/

router.post("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const workflowRequestId = Number(req.params.id);
    const adminId = req.session.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!Number.isInteger(workflowRequestId) || workflowRequestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul cererii este invalid.",
      });
    }

    const inactivity = await approveInactivityRequest(
      workflowRequestId,
      adminId,
    );

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Cererea de inactivitate a fost aprobată.",
      data: inactivity,
    });
  } catch (error) {
    console.error("Failed to approve inactivity request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Cererea de inactivitate nu a putut fi aprobată.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Reject inactivity request
|--------------------------------------------------------------------------
*/

router.post("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const workflowRequestId = Number(req.params.id);
    const adminId = req.session.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!Number.isInteger(workflowRequestId) || workflowRequestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul cererii este invalid.",
      });
    }

    const { rejectionReason } = req.body as {
      rejectionReason?: string;
    };

    if (!rejectionReason || typeof rejectionReason !== "string") {
      return res.status(400).json({
        success: false,
        message: "Motivul respingerii este obligatoriu.",
      });
    }

    const inactivity = await rejectInactivityRequest({
      workflowRequestId,
      adminId,
      rejectionReason,
    });

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Cererea de inactivitate a fost respinsă.",
      data: inactivity,
    });
  } catch (error) {
    console.error("Failed to reject inactivity request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Cererea de inactivitate nu a putut fi respinsă.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Employee - Delete own pending inactivity request
|--------------------------------------------------------------------------
*/

router.delete("/me/:id", requireAuth, async (req, res) => {
  try {
    const workflowRequestId = Number(req.params.id);
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!Number.isInteger(workflowRequestId) || workflowRequestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul cererii este invalid.",
      });
    }

    const discordMessage =
      await prepareWorkflowDiscordMessageDelete(workflowRequestId);

    const deletedInactivity = await deleteOwnPendingInactivityRequest(
      workflowRequestId,
      userId,
    );

    void deletePreparedWorkflowDiscordMessageSafe(discordMessage);

    return res.json({
      success: true,
      message: "Cererea de inactivitate a fost ștearsă.",
      data: deletedInactivity,
    });
  } catch (error) {
    console.error("Failed to delete own inactivity request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Cererea de inactivitate nu a putut fi ștearsă.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Delete inactivity request
|--------------------------------------------------------------------------
*/

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const workflowRequestId = Number(req.params.id);
    const adminId = req.session.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!Number.isInteger(workflowRequestId) || workflowRequestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul cererii este invalid.",
      });
    }

    const discordDelete = await prepareWorkflowDiscordAdminDelete(
      workflowRequestId,
      adminId,
    );

    const deletedInactivity = await deleteInactivityRequest(workflowRequestId);

    void markWorkflowDiscordMessageDeletedByAdminSafe(discordDelete);

    return res.json({
      success: true,
      message: "Cererea de inactivitate a fost ștearsă.",
      data: deletedInactivity,
    });
  } catch (error) {
    console.error("Failed to delete inactivity request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Cererea de inactivitate nu a putut fi ștearsă.",
    });
  }
});

export default router;
