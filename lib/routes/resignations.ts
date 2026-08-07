import { Router } from "express";

import { requireAuth } from "../services/requireAuth";
import { requireAdmin } from "../services/requireAdmin";
import { syncWorkflowDiscordMessageSafe } from "../discord/workflowMessages";

import {
  approveResignationRequest,
  completeResignationRequest,
  confirmResignationUniformReturn,
  createResignationRequest,
  getResignationByWorkflowId,
  rejectResignationRequest,
  getAllResignationRequests,
  getResignationRequestsForUser,
} from "../database/resignations";

const router = Router();

/*
|--------------------------------------------------------------------------
| Employee - Create resignation request
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

    const { effectiveDate, reason } = req.body as {
      effectiveDate?: string;
      reason?: string;
    };

    if (!effectiveDate || typeof effectiveDate !== "string") {
      return res.status(400).json({
        success: false,
        message: "Resignation date is required.",
      });
    }

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({
        success: false,
        message: "Resignation reason is required.",
      });
    }

    const resignation = await createResignationRequest({
      userId,
      effectiveDate,
      reason,
    });

    void syncWorkflowDiscordMessageSafe(resignation.workflow.id);

    return res.status(201).json({
      success: true,
      message: "Resignation request created successfully.",
      data: resignation,
    });
  } catch (error) {
    console.error("Failed to create resignation request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create resignation request.",
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const resignations = await getResignationRequestsForUser(userId);

    return res.json({
      success: true,
      data: resignations,
    });
  } catch (error) {
    console.error("Failed to load resignation requests for user:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load resignation requests.",
    });
  }
});

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const resignations = await getAllResignationRequests();

    return res.json({
      success: true,
      data: resignations,
    });
  } catch (error) {
    console.error("Failed to load resignation requests for admin:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load resignation requests.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Employee/Admin - Get resignation by workflow request ID
|--------------------------------------------------------------------------
*/

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const workflowRequestId = Number(req.params.id);

    if (!Number.isInteger(workflowRequestId) || workflowRequestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid resignation request ID.",
      });
    }

    const resignation = await getResignationByWorkflowId(workflowRequestId);

    if (!resignation) {
      return res.status(404).json({
        success: false,
        message: "Resignation request not found.",
      });
    }

    return res.json({
      success: true,
      data: resignation,
    });
  } catch (error) {
    console.error("Failed to load resignation request:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load resignation request.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Approve resignation
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
        message: "Invalid resignation request ID.",
      });
    }

    const resignation = await approveResignationRequest(
      workflowRequestId,
      adminId,
    );

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Resignation request approved successfully.",
      data: resignation,
    });
  } catch (error) {
    console.error("Failed to approve resignation request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to approve resignation request.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Reject resignation
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
        message: "Invalid resignation request ID.",
      });
    }

    const { rejectionReason } = req.body as {
      rejectionReason?: string;
    };

    if (!rejectionReason || typeof rejectionReason !== "string") {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required.",
      });
    }

    const resignation = await rejectResignationRequest({
      workflowRequestId,
      adminId,
      rejectionReason,
    });

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Resignation request rejected successfully.",
      data: resignation,
    });
  } catch (error) {
    console.error("Failed to reject resignation request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to reject resignation request.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Confirm uniform return
|--------------------------------------------------------------------------
*/

router.post("/:id/uniform-return", requireAdmin, async (req, res) => {
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
        message: "Invalid resignation request ID.",
      });
    }

    const resignation = await confirmResignationUniformReturn(
      workflowRequestId,
      adminId,
    );

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Uniform return confirmed successfully.",
      data: resignation,
    });
  } catch (error) {
    console.error("Failed to confirm uniform return:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to confirm uniform return.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Complete resignation
|--------------------------------------------------------------------------
*/

router.post("/:id/complete", requireAdmin, async (req, res) => {
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
        message: "Invalid resignation request ID.",
      });
    }

    const resignation = await completeResignationRequest(
      workflowRequestId,
      adminId,
    );

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Resignation completed successfully.",
      data: resignation,
    });
  } catch (error) {
    console.error("Failed to complete resignation:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to complete resignation.",
    });
  }
});

export default router;
