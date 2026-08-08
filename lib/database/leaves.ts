import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { db } from "../db";

import {
  createWorkflowHistory,
  createWorkflowRequest,
  getWorkflowRequestById,
  getWorkflowRequestByIdWithConnection,
  getWorkflowStatusByCodeWithConnection,
  getWorkflowTypeByCode,
  updateWorkflowReview,
  type WorkflowRequest,
} from "./workflow";

export interface LeaveRequest {
  id: number;
  workflowRequestId: number;
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRequestDetails {
  workflow: WorkflowRequest;
  leave: LeaveRequest;
}

export interface CreateLeaveInput {
  userId: number;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface RejectLeaveInput {
  workflowRequestId: number;
  adminId: number;
  rejectionReason: string;
}

export interface LeaveListItem {
  workflowRequestId: number;
  requestNumber: string;

  userId: number;
  employeeName: string;
  username: string;

  statusCode: string;
  statusName: string;

  startDate: string;
  endDate: string;
  reason: string;

  reviewedBy: number | null;
  reviewerName: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

interface LeaveRow extends RowDataPacket {
  id: number;
  workflow_request_id: number;
  start_date: string;
  end_date: string;
  reason: string;
  created_at: Date;
  updated_at: Date;
}

interface LeaveListRow extends RowDataPacket {
  workflow_request_id: number;
  request_number: string;

  user_id: number;
  employee_name: string | null;
  username: string;

  status_code: string;
  status_name: string;

  start_date: string;
  end_date: string;
  reason: string;

  reviewed_by: number | null;
  reviewer_name: string | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;

  created_at: Date;
  updated_at: Date;
}

interface EmployeeStateRow extends RowDataPacket {
  user_id: number;
  employee_status: "ACTIV" | "CONCEDIU" | "DEMISIONAT";
  is_active: number;
}

interface OverlappingLeaveRow extends RowDataPacket {
  id: number;
}

function mapLeave(row: LeaveRow): LeaveRequest {
  return {
    id: Number(row.id),
    workflowRequestId: Number(row.workflow_request_id),
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeaveListItem(row: LeaveListRow): LeaveListItem {
  return {
    workflowRequestId: Number(row.workflow_request_id),
    requestNumber: row.request_number,

    userId: Number(row.user_id),
    employeeName: row.employee_name ?? row.username,
    username: row.username,

    statusCode: row.status_code,
    statusName: row.status_name,

    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,

    reviewedBy: row.reviewed_by === null ? null : Number(row.reviewed_by),

    reviewerName: row.reviewer_name,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
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

async function hasOverlappingLeaveWithConnection(
  connection: PoolConnection,
  userId: number,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const [rows] = await connection.execute<OverlappingLeaveRow[]>(
    `
      SELECT
        wr.id
      FROM workflow_requests wr

      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id

      INNER JOIN workflow_statuses ws
        ON ws.id = wr.status_id

      INNER JOIN leave_requests lr
        ON lr.workflow_request_id = wr.id

      WHERE wr.user_id = ?
        AND wt.code = 'LEAVE'
        AND ws.code IN ('PENDING', 'APPROVED')
        AND lr.start_date <= ?
        AND lr.end_date >= ?

      LIMIT 1
    `,
    [userId, endDate, startDate],
  );

  return rows.length > 0;
}

async function getLeaveByWorkflowIdWithConnection(
  connection: PoolConnection,
  workflowRequestId: number,
): Promise<LeaveRequest | null> {
  const [rows] = await connection.execute<LeaveRow[]>(
    `
      SELECT
        id,
        workflow_request_id,
        start_date,
        end_date,
        reason,
        created_at,
        updated_at
      FROM leave_requests
      WHERE workflow_request_id = ?
      LIMIT 1
    `,
    [workflowRequestId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapLeave(rows[0]);
}

export async function getLeaveByWorkflowId(
  workflowRequestId: number,
): Promise<LeaveRequest | null> {
  const [rows] = await db.execute<LeaveRow[]>(
    `
      SELECT
        id,
        workflow_request_id,
        start_date,
        end_date,
        reason,
        created_at,
        updated_at
      FROM leave_requests
      WHERE workflow_request_id = ?
      LIMIT 1
    `,
    [workflowRequestId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapLeave(rows[0]);
}

export async function getLeaveById(
  leaveId: number,
): Promise<LeaveRequest | null> {
  const [rows] = await db.execute<LeaveRow[]>(
    `
      SELECT
        id,
        workflow_request_id,
        start_date,
        end_date,
        reason,
        created_at,
        updated_at
      FROM leave_requests
      WHERE id = ?
      LIMIT 1
    `,
    [leaveId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapLeave(rows[0]);
}

export async function getLeaveRequestsForUser(
  userId: number,
): Promise<LeaveListItem[]> {
  const [rows] = await db.execute<LeaveListRow[]>(
    `
      SELECT
        wr.id AS workflow_request_id,
        wr.request_number,

        wr.user_id,

        CONCAT_WS(
          ' ',
          employee_contract.first_name,
          employee_contract.last_name
        ) AS employee_name,

        u.username,

        ws.code AS status_code,
        ws.name AS status_name,

        lr.start_date,
        lr.end_date,
        lr.reason,

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

      INNER JOIN leave_requests lr
        ON lr.workflow_request_id = wr.id

      INNER JOIN users u
        ON u.id = wr.user_id

      LEFT JOIN employee_contracts employee_contract
        ON employee_contract.user_id = wr.user_id

      LEFT JOIN employee_contracts reviewer_contract
        ON reviewer_contract.user_id = wr.reviewed_by

      WHERE wr.user_id = ?
        AND wt.code = 'LEAVE'

      ORDER BY
        wr.created_at DESC,
        wr.id DESC
    `,
    [userId],
  );

  return rows.map(mapLeaveListItem);
}

export async function getAllLeaveRequests(): Promise<LeaveListItem[]> {
  const [rows] = await db.execute<LeaveListRow[]>(
    `
      SELECT
        wr.id AS workflow_request_id,
        wr.request_number,

        wr.user_id,

        CONCAT_WS(
          ' ',
          employee_contract.first_name,
          employee_contract.last_name
        ) AS employee_name,

        u.username,

        ws.code AS status_code,
        ws.name AS status_name,

        lr.start_date,
        lr.end_date,
        lr.reason,

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

      INNER JOIN leave_requests lr
        ON lr.workflow_request_id = wr.id

      INNER JOIN users u
        ON u.id = wr.user_id

      LEFT JOIN employee_contracts employee_contract
        ON employee_contract.user_id = wr.user_id

      LEFT JOIN employee_contracts reviewer_contract
        ON reviewer_contract.user_id = wr.reviewed_by

      WHERE wt.code = 'LEAVE'

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

  return rows.map(mapLeaveListItem);
}

export async function createLeaveRequest(
  input: CreateLeaveInput,
): Promise<LeaveRequestDetails> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const workflowType = await getWorkflowTypeByCode("LEAVE");

    if (!workflowType) {
      throw new Error("LEAVE workflow type is not configured.");
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
      throw new Error("Inactive users cannot create leave requests.");
    }

    if (employee.employee_status === "DEMISIONAT") {
      throw new Error("Resigned employees cannot create leave requests.");
    }

    const reason = input.reason.trim();

    if (!reason) {
      throw new Error("Leave reason is required.");
    }

    if (reason.length > 1000) {
      throw new Error("Leave reason cannot exceed 1000 characters.");
    }

    const startDate = parseDate(input.startDate);
    const endDate = parseDate(input.endDate);

    if (Number.isNaN(startDate.getTime())) {
      throw new Error("Invalid leave start date.");
    }

    if (Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid leave end date.");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      throw new Error("Leave start date cannot be in the past.");
    }

    if (endDate < startDate) {
      throw new Error("Leave end date cannot be before the start date.");
    }

    const hasOverlap = await hasOverlappingLeaveWithConnection(
      connection,
      input.userId,
      input.startDate,
      input.endDate,
    );

    if (hasOverlap) {
      throw new Error(
        "You already have a pending or approved leave request that overlaps this period.",
      );
    }

    const workflow = await createWorkflowRequest(connection, {
      workflowTypeId: workflowType.id,
      userId: input.userId,
      statusId: pendingStatus.id,
    });

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO leave_requests (
          workflow_request_id,
          start_date,
          end_date,
          reason
        )
        VALUES (?, ?, ?, ?)
      `,
      [workflow.id, input.startDate, input.endDate, reason],
    );

    const leaveId = Number(result.insertId);

    await createWorkflowHistory(connection, {
      workflowRequestId: workflow.id,
      action: "CREATED",
      performedBy: input.userId,
      oldStatusId: null,
      newStatusId: pendingStatus.id,
      metadata: {
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    await connection.commit();

    const leave = await getLeaveById(leaveId);

    if (!leave) {
      throw new Error("Leave request could not be loaded after creation.");
    }

    return {
      workflow,
      leave,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function approveLeaveRequest(
  workflowRequestId: number,
  adminId: number,
): Promise<LeaveRequestDetails> {
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

    const leave = await getLeaveByWorkflowIdWithConnection(
      connection,
      workflowRequestId,
    );

    if (!leave) {
      throw new Error("Leave request was not found.");
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
      throw new Error("Only pending leave requests can be approved.");
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
      metadata: {
        startDate: leave.startDate,
        endDate: leave.endDate,
      },
    });

    await connection.commit();

    const updatedWorkflow = await getWorkflowRequestById(workflowRequestId);

    const updatedLeave = await getLeaveByWorkflowId(workflowRequestId);

    if (!updatedWorkflow || !updatedLeave) {
      throw new Error("Approved leave request could not be loaded.");
    }

    return {
      workflow: updatedWorkflow,
      leave: updatedLeave,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function rejectLeaveRequest(
  input: RejectLeaveInput,
): Promise<LeaveRequestDetails> {
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

    const leave = await getLeaveByWorkflowIdWithConnection(
      connection,
      input.workflowRequestId,
    );

    if (!leave) {
      throw new Error("Leave request was not found.");
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
      throw new Error("Only pending leave requests can be rejected.");
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

    const updatedLeave = await getLeaveByWorkflowId(input.workflowRequestId);

    if (!updatedWorkflow || !updatedLeave) {
      throw new Error("Rejected leave request could not be loaded.");
    }

    return {
      workflow: updatedWorkflow,
      leave: updatedLeave,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
