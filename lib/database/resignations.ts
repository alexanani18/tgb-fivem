import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { db } from "../db";

import {
  createWorkflowHistory,
  createWorkflowRequest,
  getWorkflowRequestByIdWithConnection,
  getWorkflowStatusByCodeWithConnection,
  getWorkflowTypeByCode,
  updateWorkflowReview,
  type WorkflowRequest,
} from "./workflow";

export interface ResignationRequest {
  id: number;
  workflowRequestId: number;
  effectiveDate: string;
  reason: string;

  uniformReturned: boolean;
  uniformReturnedAt: Date | null;
  uniformReturnedConfirmedBy: number | null;

  completedAt: Date | null;
  completedBy: number | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface ResignationRequestDetails {
  workflow: WorkflowRequest;
  resignation: ResignationRequest;
}

export interface CreateResignationInput {
  userId: number;
  effectiveDate: string;
  reason: string;
}

export interface RejectResignationInput {
  workflowRequestId: number;
  adminId: number;
  rejectionReason: string;
}

interface ResignationRow extends RowDataPacket {
  id: number;
  workflow_request_id: number;
  effective_date: string;
  reason: string;

  uniform_returned: number;
  uniform_returned_at: Date | null;
  uniform_returned_confirmed_by: number | null;

  completed_at: Date | null;
  completed_by: number | null;

  created_at: Date;
  updated_at: Date;
}

interface ActiveResignationRow extends RowDataPacket {
  id: number;
}

interface EmployeeStateRow extends RowDataPacket {
  user_id: number;
  employee_status: "ACTIV" | "CONCEDIU" | "DEMISIONAT";
  has_uniform: number;
  is_active: number;
}

export interface ResignationListItem {
  workflowRequestId: number;
  requestNumber: string;

  userId: number;
  employeeName: string;
  username: string;

  statusCode: string;
  statusName: string;

  effectiveDate: string;
  reason: string;

  uniformReturned: boolean;
  completedAt: Date | null;

  reviewedBy: number | null;
  reviewerName: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

interface ResignationListRow extends RowDataPacket {
  workflow_request_id: number;
  request_number: string;

  user_id: number;
  employee_name: string | null;
  username: string;

  status_code: string;
  status_name: string;

  effective_date: string;
  reason: string;

  uniform_returned: number;
  completed_at: Date | null;

  reviewed_by: number | null;
  reviewer_name: string | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;

  created_at: Date;
  updated_at: Date;
}

function mapResignation(row: ResignationRow): ResignationRequest {
  return {
    id: Number(row.id),
    workflowRequestId: Number(row.workflow_request_id),
    effectiveDate: row.effective_date,
    reason: row.reason,

    uniformReturned: Boolean(row.uniform_returned),

    uniformReturnedAt: row.uniform_returned_at,

    uniformReturnedConfirmedBy:
      row.uniform_returned_confirmed_by === null
        ? null
        : Number(row.uniform_returned_confirmed_by),

    completedAt: row.completed_at,

    completedBy: row.completed_by === null ? null : Number(row.completed_by),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResignationListItem(row: ResignationListRow): ResignationListItem {
  return {
    workflowRequestId: Number(row.workflow_request_id),
    requestNumber: row.request_number,

    userId: Number(row.user_id),
    employeeName: row.employee_name ?? row.username,
    username: row.username,

    statusCode: row.status_code,
    statusName: row.status_name,

    effectiveDate: row.effective_date,
    reason: row.reason,

    uniformReturned: Boolean(row.uniform_returned),
    completedAt: row.completed_at,

    reviewedBy: row.reviewed_by === null ? null : Number(row.reviewed_by),

    reviewerName: row.reviewer_name,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getResignationRequestsForUser(
  userId: number,
): Promise<ResignationListItem[]> {
  const [rows] = await db.execute<ResignationListRow[]>(
    `
      SELECT
        wr.id AS workflow_request_id,
        wr.request_number,

        wr.user_id,
        CONCAT_WS(
          ' ',
          ec.first_name,
          ec.last_name
        ) AS employee_name,
        u.username,

        ws.code AS status_code,
        ws.name AS status_name,

        rr.effective_date,
        rr.reason,

        rr.uniform_returned,
        rr.completed_at,

        wr.reviewed_by,

        CONCAT_WS(
          ' ',
          reviewer_contract.first_name,
          reviewer_contract.last_name
        ) AS reviewer_name,

        wr.reviewed_at,
        wr.rejection_reason,

        wr.created_at,
        wr.updated_at

      FROM workflow_requests wr

      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id

      INNER JOIN workflow_statuses ws
        ON ws.id = wr.status_id

      INNER JOIN resignation_requests rr
        ON rr.workflow_request_id = wr.id

      INNER JOIN users u
        ON u.id = wr.user_id

      LEFT JOIN employee_contracts ec
        ON ec.user_id = wr.user_id

      LEFT JOIN employee_contracts reviewer_contract
        ON reviewer_contract.user_id = wr.reviewed_by

      WHERE wr.user_id = ?
        AND wt.code = 'RESIGNATION'

      ORDER BY wr.created_at DESC, wr.id DESC
    `,
    [userId],
  );

  return rows.map(mapResignationListItem);
}

export async function getAllResignationRequests(): Promise<
  ResignationListItem[]
> {
  const [rows] = await db.execute<ResignationListRow[]>(
    `
      SELECT
        wr.id AS workflow_request_id,
        wr.request_number,

        wr.user_id,
        CONCAT_WS(
          ' ',
          ec.first_name,
          ec.last_name
        ) AS employee_name,
        u.username,

        ws.code AS status_code,
        ws.name AS status_name,

        rr.effective_date,
        rr.reason,

        rr.uniform_returned,
        rr.completed_at,

        wr.reviewed_by,

        CONCAT_WS(
          ' ',
          reviewer_contract.first_name,
          reviewer_contract.last_name
        ) AS reviewer_name,

        wr.reviewed_at,
        wr.rejection_reason,

        wr.created_at,
        wr.updated_at

      FROM workflow_requests wr

      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id

      INNER JOIN workflow_statuses ws
        ON ws.id = wr.status_id

      INNER JOIN resignation_requests rr
        ON rr.workflow_request_id = wr.id

      INNER JOIN users u
        ON u.id = wr.user_id

      LEFT JOIN employee_contracts ec
        ON ec.user_id = wr.user_id

      LEFT JOIN employee_contracts reviewer_contract
        ON reviewer_contract.user_id = wr.reviewed_by

      WHERE wt.code = 'RESIGNATION'

      ORDER BY
        CASE ws.code
          WHEN 'PENDING' THEN 1
          WHEN 'APPROVED' THEN 2
          WHEN 'REJECTED' THEN 3
          WHEN 'CANCELLED' THEN 4
          ELSE 5
        END,
        wr.created_at DESC,
        wr.id DESC
    `,
  );

  return rows.map(mapResignationListItem);
}

async function getResignationByWorkflowIdWithConnection(
  connection: PoolConnection,
  workflowRequestId: number,
): Promise<ResignationRequest | null> {
  const [rows] = await connection.execute<ResignationRow[]>(
    `
      SELECT
        id,
        workflow_request_id,
        effective_date,
        reason,
        uniform_returned,
        uniform_returned_at,
        uniform_returned_confirmed_by,
        completed_at,
        completed_by,
        created_at,
        updated_at
      FROM resignation_requests
      WHERE workflow_request_id = ?
      LIMIT 1
    `,
    [workflowRequestId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapResignation(rows[0]);
}

export async function getResignationByWorkflowIdForUser(
  workflowRequestId: number,
  userId: number,
): Promise<ResignationRequest | null> {
  const [rows] = await db.execute<ResignationRow[]>(
    `
      SELECT
        rr.id,
        rr.workflow_request_id,
        rr.effective_date,
        rr.reason,
        rr.uniform_returned,
        rr.uniform_returned_at,
        rr.uniform_returned_confirmed_by,
        rr.completed_at,
        rr.completed_by,
        rr.created_at,
        rr.updated_at
      FROM resignation_requests rr
      INNER JOIN workflow_requests wr
        ON wr.id = rr.workflow_request_id
      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id
      WHERE rr.workflow_request_id = ?
        AND wr.user_id = ?
        AND wt.code = 'RESIGNATION'
      LIMIT 1
    `,
    [workflowRequestId, userId],
  );

  return rows[0] ? mapResignation(rows[0]) : null;
}

export async function getResignationByWorkflowIdForAdmin(
  workflowRequestId: number,
): Promise<ResignationRequest | null> {
  const [rows] = await db.execute<ResignationRow[]>(
    `
      SELECT
        rr.id,
        rr.workflow_request_id,
        rr.effective_date,
        rr.reason,
        rr.uniform_returned,
        rr.uniform_returned_at,
        rr.uniform_returned_confirmed_by,
        rr.completed_at,
        rr.completed_by,
        rr.created_at,
        rr.updated_at
      FROM resignation_requests rr
      INNER JOIN workflow_requests wr
        ON wr.id = rr.workflow_request_id
      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id
      WHERE rr.workflow_request_id = ?
        AND wt.code = 'RESIGNATION'
      LIMIT 1
    `,
    [workflowRequestId],
  );

  return rows[0] ? mapResignation(rows[0]) : null;
}

async function getEmployeeStateWithConnection(
  connection: PoolConnection,
  userId: number,
): Promise<EmployeeStateRow | null> {
  const [rows] = await connection.execute<EmployeeStateRow[]>(
    `
      SELECT
        ed.user_id,
        ed.status AS employee_status,
        ed.has_uniform,
        u.is_active
      FROM employee_details ed

      INNER JOIN users u
        ON u.id = ed.user_id

      WHERE ed.user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

async function hasActiveResignationWithConnection(
  connection: PoolConnection,
  userId: number,
): Promise<boolean> {
  const [rows] = await connection.execute<ActiveResignationRow[]>(
    `
      SELECT
        wr.id
      FROM workflow_requests wr

      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id

      INNER JOIN workflow_statuses ws
        ON ws.id = wr.status_id

      INNER JOIN resignation_requests rr
        ON rr.workflow_request_id = wr.id

      WHERE wr.user_id = ?
        AND wt.code = 'RESIGNATION'
        AND (
          ws.code = 'PENDING'
          OR (
            ws.code = 'APPROVED'
            AND rr.completed_at IS NULL
          )
        )
      LIMIT 1
    `,
    [userId],
  );

  return rows.length > 0;
}

export async function createResignationRequest(
  input: CreateResignationInput,
): Promise<ResignationRequestDetails> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const workflowType = await getWorkflowTypeByCode("RESIGNATION");

    if (!workflowType) {
      throw new Error("RESIGNATION workflow type is not configured.");
    }

    const pendingStatus = await getWorkflowStatusByCodeWithConnection(
      connection,
      "PENDING",
    );

    if (!pendingStatus) {
      throw new Error("PENDING workflow status is not configured.");
    }

    const employee = await getEmployeeStateWithConnection(
      connection,
      input.userId,
    );

    if (!employee) {
      throw new Error("Employee details were not found.");
    }

    if (!employee.is_active) {
      throw new Error("Inactive users cannot create resignation requests.");
    }

    if (employee.employee_status === "DEMISIONAT") {
      throw new Error("Resigned employees cannot create resignation requests.");
    }

    const alreadyHasActiveResignation =
      await hasActiveResignationWithConnection(connection, input.userId);

    if (alreadyHasActiveResignation) {
      throw new Error("You already have an active resignation request.");
    }

    const reason = input.reason.trim();

    if (!reason) {
      throw new Error("Resignation reason is required.");
    }

    if (reason.length > 1000) {
      throw new Error("Resignation reason cannot exceed 1000 characters.");
    }

    const effectiveDate = new Date(`${input.effectiveDate}T00:00:00`);

    if (Number.isNaN(effectiveDate.getTime())) {
      throw new Error("Invalid resignation date.");
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (effectiveDate < today) {
      throw new Error("Resignation date cannot be in the past.");
    }

    const workflow = await createWorkflowRequest(connection, {
      workflowTypeId: workflowType.id,
      userId: input.userId,
      statusId: pendingStatus.id,
    });

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO resignation_requests (
          workflow_request_id,
          effective_date,
          reason
        )
        VALUES (?, ?, ?)
      `,
      [workflow.id, input.effectiveDate, reason],
    );

    const resignationId = Number(result.insertId);

    await createWorkflowHistory(connection, {
      workflowRequestId: workflow.id,
      action: "CREATED",
      performedBy: input.userId,
      oldStatusId: null,
      newStatusId: pendingStatus.id,
      metadata: {
        effectiveDate: input.effectiveDate,
      },
    });

    await connection.commit();

    const resignation = await getResignationById(resignationId);

    if (!resignation) {
      throw new Error(
        "Resignation request could not be loaded after creation.",
      );
    }

    return {
      workflow,
      resignation,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getResignationById(
  resignationId: number,
): Promise<ResignationRequest | null> {
  const [rows] = await db.execute<ResignationRow[]>(
    `
      SELECT
        id,
        workflow_request_id,
        effective_date,
        reason,
        uniform_returned,
        uniform_returned_at,
        uniform_returned_confirmed_by,
        completed_at,
        completed_by,
        created_at,
        updated_at
      FROM resignation_requests
      WHERE id = ?
      LIMIT 1
    `,
    [resignationId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapResignation(rows[0]);
}

export async function approveResignationRequest(
  workflowRequestId: number,
  adminId: number,
): Promise<ResignationRequestDetails> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const workflow = await getWorkflowRequestByIdWithConnection(
      connection,
      workflowRequestId,
    );

    if (!workflow) {
      throw new Error("Workflow request was not found.");
    }

    const resignation = await getResignationByWorkflowIdWithConnection(
      connection,
      workflowRequestId,
    );

    if (!resignation) {
      throw new Error("Resignation request was not found.");
    }

    const pendingStatus = await getWorkflowStatusByCodeWithConnection(
      connection,
      "PENDING",
    );

    const approvedStatus = await getWorkflowStatusByCodeWithConnection(
      connection,
      "APPROVED",
    );

    if (!pendingStatus || !approvedStatus) {
      throw new Error("Workflow statuses are not configured.");
    }

    if (workflow.statusId !== pendingStatus.id) {
      throw new Error("Only pending resignation requests can be approved.");
    }

    await updateWorkflowReview(connection, {
      workflowRequestId,
      statusId: approvedStatus.id,
      reviewedBy: adminId,
      rejectionReason: null,
    });

    await createWorkflowHistory(connection, {
      workflowRequestId,
      action: "APPROVED",
      performedBy: adminId,
      oldStatusId: pendingStatus.id,
      newStatusId: approvedStatus.id,
    });

    await connection.commit();

    const updatedWorkflow = await getWorkflowRequestById(workflowRequestId);

    const updatedResignation =
      await getResignationByWorkflowIdForAdmin(workflowRequestId);

    if (!updatedWorkflow || !updatedResignation) {
      throw new Error("Approved resignation could not be loaded.");
    }

    return {
      workflow: updatedWorkflow,
      resignation: updatedResignation,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function rejectResignationRequest(
  input: RejectResignationInput,
): Promise<ResignationRequestDetails> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const workflow = await getWorkflowRequestByIdWithConnection(
      connection,
      input.workflowRequestId,
    );

    if (!workflow) {
      throw new Error("Workflow request was not found.");
    }

    const resignation = await getResignationByWorkflowIdWithConnection(
      connection,
      input.workflowRequestId,
    );

    if (!resignation) {
      throw new Error("Resignation request was not found.");
    }

    const rejectionReason = input.rejectionReason.trim();

    if (!rejectionReason) {
      throw new Error("Rejection reason is required.");
    }

    if (rejectionReason.length > 1000) {
      throw new Error("Rejection reason cannot exceed 1000 characters.");
    }

    const pendingStatus = await getWorkflowStatusByCodeWithConnection(
      connection,
      "PENDING",
    );

    const rejectedStatus = await getWorkflowStatusByCodeWithConnection(
      connection,
      "REJECTED",
    );

    if (!pendingStatus || !rejectedStatus) {
      throw new Error("Workflow statuses are not configured.");
    }

    if (workflow.statusId !== pendingStatus.id) {
      throw new Error("Only pending resignation requests can be rejected.");
    }

    await updateWorkflowReview(connection, {
      workflowRequestId: input.workflowRequestId,
      statusId: rejectedStatus.id,
      reviewedBy: input.adminId,
      rejectionReason,
    });

    await createWorkflowHistory(connection, {
      workflowRequestId: input.workflowRequestId,
      action: "REJECTED",
      performedBy: input.adminId,
      oldStatusId: pendingStatus.id,
      newStatusId: rejectedStatus.id,
      comment: rejectionReason,
    });

    await connection.commit();

    const updatedWorkflow = await getWorkflowRequestById(
      input.workflowRequestId,
    );

    const updatedResignation = await getResignationByWorkflowIdForAdmin(
      input.workflowRequestId,
    );

    if (!updatedWorkflow || !updatedResignation) {
      throw new Error("Rejected resignation could not be loaded.");
    }

    return {
      workflow: updatedWorkflow,
      resignation: updatedResignation,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function confirmResignationUniformReturn(
  workflowRequestId: number,
  adminId: number,
): Promise<ResignationRequestDetails> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const workflow = await getWorkflowRequestByIdWithConnection(
      connection,
      workflowRequestId,
    );

    if (!workflow) {
      throw new Error("Workflow request was not found.");
    }

    const resignation = await getResignationByWorkflowIdWithConnection(
      connection,
      workflowRequestId,
    );

    if (!resignation) {
      throw new Error("Resignation request was not found.");
    }

    const approvedStatus = await getWorkflowStatusByCodeWithConnection(
      connection,
      "APPROVED",
    );

    if (!approvedStatus) {
      throw new Error("APPROVED workflow status is not configured.");
    }

    if (workflow.statusId !== approvedStatus.id) {
      throw new Error(
        "Uniform return can only be confirmed for approved resignation requests.",
      );
    }

    if (resignation.completedAt) {
      throw new Error("This resignation request is already completed.");
    }

    if (resignation.uniformReturned) {
      throw new Error("Uniform return has already been confirmed.");
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE resignation_requests
        SET
          uniform_returned = 1,
          uniform_returned_at = CURRENT_TIMESTAMP,
          uniform_returned_confirmed_by = ?
        WHERE workflow_request_id = ?
      `,
      [adminId, workflowRequestId],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE employee_details
        SET has_uniform = 0
        WHERE user_id = ?
      `,
      [workflow.userId],
    );

    await createWorkflowHistory(connection, {
      workflowRequestId,
      action: "UNIFORM_RETURNED",
      performedBy: adminId,
      oldStatusId: approvedStatus.id,
      newStatusId: approvedStatus.id,
    });

    await connection.commit();

    const updatedWorkflow = await getWorkflowRequestById(workflowRequestId);

    const updatedResignation =
      await getResignationByWorkflowIdForAdmin(workflowRequestId);

    if (!updatedWorkflow || !updatedResignation) {
      throw new Error(
        "Resignation request could not be loaded after uniform confirmation.",
      );
    }

    return {
      workflow: updatedWorkflow,
      resignation: updatedResignation,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function completeResignationRequest(
  workflowRequestId: number,
  adminId: number,
): Promise<ResignationRequestDetails> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const workflow = await getWorkflowRequestByIdWithConnection(
      connection,
      workflowRequestId,
    );

    if (!workflow) {
      throw new Error("Workflow request was not found.");
    }

    const resignation = await getResignationByWorkflowIdWithConnection(
      connection,
      workflowRequestId,
    );

    if (!resignation) {
      throw new Error("Resignation request was not found.");
    }

    const approvedStatus = await getWorkflowStatusByCodeWithConnection(
      connection,
      "APPROVED",
    );

    if (!approvedStatus) {
      throw new Error("APPROVED workflow status is not configured.");
    }

    if (workflow.statusId !== approvedStatus.id) {
      throw new Error("Only approved resignation requests can be completed.");
    }

    if (!resignation.uniformReturned) {
      throw new Error(
        "The employee must return the uniform before the resignation can be completed.",
      );
    }

    if (resignation.completedAt) {
      throw new Error("This resignation request has already been completed.");
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE resignation_requests
        SET
          completed_at = CURRENT_TIMESTAMP,
          completed_by = ?
        WHERE workflow_request_id = ?
      `,
      [adminId, workflowRequestId],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE employee_details
        SET status = 'DEMISIONAT'
        WHERE user_id = ?
      `,
      [workflow.userId],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET
          is_active = 0
        WHERE id = ?
      `,
      [workflow.userId],
    );

    await createWorkflowHistory(connection, {
      workflowRequestId,
      action: "COMPLETED",
      performedBy: adminId,
      oldStatusId: approvedStatus.id,
      newStatusId: approvedStatus.id,
    });

    await connection.commit();

    const updatedWorkflow = await getWorkflowRequestById(workflowRequestId);

    const updatedResignation =
      await getResignationByWorkflowIdForAdmin(workflowRequestId);

    if (!updatedWorkflow || !updatedResignation) {
      throw new Error("Completed resignation could not be loaded.");
    }

    return {
      workflow: updatedWorkflow,
      resignation: updatedResignation,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getWorkflowRequestById(
  workflowRequestId: number,
): Promise<WorkflowRequest | null> {
  const connection = await db.getConnection();

  try {
    return await getWorkflowRequestByIdWithConnection(
      connection,
      workflowRequestId,
    );
  } finally {
    connection.release();
  }
}
