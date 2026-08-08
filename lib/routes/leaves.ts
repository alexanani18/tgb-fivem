import { Router } from "express";

import {
  approveLeaveRequest,
  createLeaveRequest,
  deleteLeaveRequest,
  getAllLeaveRequests,
  getLeaveByWorkflowIdForAdmin,
  getLeaveByWorkflowIdForUser,
  getLeaveRequestsForUser,
  rejectLeaveRequest,
  deleteOwnPendingLeaveRequest,
} from "../database/leaves";

import {
  deletePreparedWorkflowDiscordMessageSafe,
  markWorkflowDiscordMessageDeletedByAdminSafe,
  prepareWorkflowDiscordAdminDelete,
  prepareWorkflowDiscordMessageDelete,
  syncWorkflowDiscordMessageSafe,
} from "../discord/workflowMessages";

import { PublicError } from "../services/publicError";
import { requireAdmin } from "../services/requireAdmin";
import { requireAuth } from "../services/requireAuth";
import { runLeaveStatusSync } from "../services/leaveStatusSync";


const router = Router();

/*
|--------------------------------------------------------------------------
| Employee - Create leave request
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

    const { startDate, endDate, reason } = req.body as {
      startDate?: string;
      endDate?: string;
      reason?: string;
    };

    if (!startDate || typeof startDate !== "string") {
      return res.status(400).json({
        success: false,
        message: "Data de început este obligatorie.",
      });
    }

    if (!endDate || typeof endDate !== "string") {
      return res.status(400).json({
        success: false,
        message: "Data de sfârșit este obligatorie.",
      });
    }

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({
        success: false,
        message: "Motivul este obligatoriu.",
      });
    }

    const leave = await createLeaveRequest({
      userId,
      startDate,
      endDate,
      reason,
    });

    void syncWorkflowDiscordMessageSafe(leave.workflow.id);

    return res.status(201).json({
      success: true,
      message: "Cererea de concediu a fost trimisă.",
      data: leave,
    });
  } catch (error) {
    console.error("Failed to create leave request:", error);

    if (error instanceof PublicError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Cererea de concediu nu a putut fi creată.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Employee - Own leave requests
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

    const leaves = await getLeaveRequestsForUser(userId);

    return res.json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    console.error("Failed to load user leave requests:", error);

    return res.status(500).json({
      success: false,
      message: "Cererile de concediu nu au putut fi încărcate.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - All leave requests
|--------------------------------------------------------------------------
*/

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const leaves = await getAllLeaveRequests();

    return res.json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    console.error("Failed to load admin leave requests:", error);

    return res.status(500).json({
      success: false,
      message: "Cererile de concediu nu au putut fi încărcate.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Employee/Admin - Leave details
|--------------------------------------------------------------------------
*/

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const viewer = req.session.user;
    const workflowRequestId = Number(req.params.id);

    if (!viewer) {
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

    const leave =
      viewer.role === "ADMIN"
        ? await getLeaveByWorkflowIdForAdmin(workflowRequestId)
        : await getLeaveByWorkflowIdForUser(workflowRequestId, viewer.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Cererea de concediu nu a fost găsită.",
      });
    }

    return res.json({
      success: true,
      data: leave,
    });
  } catch (error) {
    console.error("Failed to load leave request:", error);

    return res.status(500).json({
      success: false,
      message: "Cererea de concediu nu a putut fi încărcată.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Approve leave request
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

    const leave = await approveLeaveRequest(workflowRequestId, adminId);

    /*
     * Dacă perioada concediului include ziua curentă,
     * angajatul trebuie trecut imediat în CONCEDIU.
     *
     * Dacă concediul începe în viitor, sync-ul nu
     * modifică nimic acum și îl va activa la 00:00
     * în ziua potrivită.
     */

    await runLeaveStatusSync();

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Cererea de concediu a fost aprobată.",
      data: leave,
    });
  } catch (error) {
    console.error("Failed to approve leave request:", error);

    if (error instanceof PublicError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Cererea de concediu nu a putut fi aprobată.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Reject leave request
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

    const leave = await rejectLeaveRequest({
      workflowRequestId,
      adminId,
      rejectionReason,
    });

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Cererea de concediu a fost respinsă.",
      data: leave,
    });
  } catch (error) {
    console.error("Failed to reject leave request:", error);

    if (error instanceof PublicError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Cererea de concediu nu a putut fi respinsă.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Angajat - Delete leave request
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

    const deletedLeave = await deleteOwnPendingLeaveRequest(
      workflowRequestId,
      userId,
    );

    void deletePreparedWorkflowDiscordMessageSafe(discordMessage);

    return res.json({
      success: true,
      message: "Cererea de concediu a fost ștearsă.",
      data: deletedLeave,
    });
  } catch (error) {
    console.error("Failed to delete own leave request:", error);

    if (error instanceof PublicError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Cererea de concediu nu a putut fi ștearsă.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Delete leave request
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

    const deletedLeave = await deleteLeaveRequest(workflowRequestId);

    await runLeaveStatusSync();

    void markWorkflowDiscordMessageDeletedByAdminSafe(discordDelete);

    return res.json({
      success: true,
      message: "Cererea de concediu a fost ștearsă.",
      data: deletedLeave,
    });
  } catch (error) {
    console.error("Failed to delete leave request:", error);

    if (error instanceof PublicError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Cererea de concediu nu a putut fi ștearsă.",
    });
  }
});

export default router;
