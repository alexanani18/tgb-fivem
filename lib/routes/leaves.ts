import { Router } from "express";

import { requireAuth } from "../services/requireAuth";
import { requireAdmin } from "../services/requireAdmin";
import { runLeaveStatusSync } from "../services/leaveStatusSync";

import { syncWorkflowDiscordMessageSafe } from "../discord/workflowMessages";

import {
  approveLeaveRequest,
  createLeaveRequest,
  getAllLeaveRequests,
  getLeaveByWorkflowId,
  getLeaveRequestsForUser,
  rejectLeaveRequest,
} from "../database/leaves";

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
        message: "Leave start date is required.",
      });
    }

    if (!endDate || typeof endDate !== "string") {
      return res.status(400).json({
        success: false,
        message: "Leave end date is required.",
      });
    }

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({
        success: false,
        message: "Leave reason is required.",
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
      message: "Leave request created successfully.",
      data: leave,
    });
  } catch (error) {
    console.error("Failed to create leave request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create leave request.",
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
    console.error("Failed to load leave requests for user:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load leave requests.",
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
    console.error("Failed to load leave requests for admin:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load leave requests.",
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
    const workflowRequestId = Number(req.params.id);

    if (!Number.isInteger(workflowRequestId) || workflowRequestId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID.",
      });
    }

    const leave = await getLeaveByWorkflowId(workflowRequestId);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found.",
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
      message: "Failed to load leave request.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Approve leave
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
        message: "Invalid leave request ID.",
      });
    }

    const leave = await approveLeaveRequest(workflowRequestId, adminId);

    await runLeaveStatusSync();

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Leave request approved successfully.",
      data: leave,
    });
  } catch (error) {
    console.error("Failed to approve leave request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to approve leave request.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| Admin - Reject leave
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
        message: "Invalid leave request ID.",
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

    const leave = await rejectLeaveRequest({
      workflowRequestId,
      adminId,
      rejectionReason,
    });

    void syncWorkflowDiscordMessageSafe(workflowRequestId);

    return res.json({
      success: true,
      message: "Leave request rejected successfully.",
      data: leave,
    });
  } catch (error) {
    console.error("Failed to reject leave request:", error);

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to reject leave request.",
    });
  }
});

export default router;
