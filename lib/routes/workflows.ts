import { Router } from "express";

import {
  getAdminWorkflowRequests,
  getPendingWorkflowRequestCount,
} from "../database/workflow";

import { requireAdmin } from "../services/requireAdmin";

const router = Router();

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const requests = await getAdminWorkflowRequests();

    return res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("Failed to load workflow requests:", error);

    return res.status(500).json({
      success: false,
      message: "Cererile nu au putut fi încărcate.",
    });
  }
});

router.get("/admin/pending-count", requireAdmin, async (_req, res) => {
  try {
    const count = await getPendingWorkflowRequestCount();

    return res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Failed to load pending workflow request count:", error);

    return res.status(500).json({
      success: false,
      message: "Numărul cererilor în așteptare nu a putut fi încărcat.",
    });
  }
});

export default router;
