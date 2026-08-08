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

export interface InactivityRequest {
  id: number;
  workflowRequestId: number;
  activity: string;
  activityDate: string | Date;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InactivityRequestDetails {
  workflow: WorkflowRequest;
  inactivity: InactivityRequest;
}

export interface CreateInactivityInput {
  userId: number;
  activity: string;
  activityDate: string;
  reason: string;
}

export interface RejectInactivityInput {
  workflowRequestId: number;
  adminId: number;
  rejectionReason: string;
}

export interface InactivityListItem {
  workflowRequestId: number;
  requestNumber: string;

  userId: number;
  employeeName: string;
  username: string;

  statusCode: string;
  statusName: string;

  activity: string;
  activityDate: string;
  reason: string;

  reviewedBy: number | null;
  reviewerName: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

interface InactivityRow extends RowDataPacket {
  id: number;
  workflow_request_id: number;
  activity: string;
  activity_date: string | Date;
  reason: string;
  created_at: Date;
  updated_at: Date;
}

interface InactivityListRow extends RowDataPacket {
  workflow_request_id: number;
  request_number: string;

  user_id: number;
  employee_name: string | null;
  username: string;

  status_code: string;
  status_name: string;

  activity: string;
  activity_date: string;
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

interface DuplicateInactivityRow extends RowDataPacket {
  id: number;
}

export interface DeleteInactivityResult {
  workflowRequestId: number;
  userId: number;
}

interface DeleteInactivityRow extends RowDataPacket {
  workflow_request_id: number;
  user_id: number;
}

function mapInactivity(row: InactivityRow): InactivityRequest {
  return {
    id: Number(row.id),
    workflowRequestId: Number(row.workflow_request_id),
    activity: row.activity,
    activityDate: row.activity_date,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInactivityListItem(row: InactivityListRow): InactivityListItem {
  return {
    workflowRequestId: Number(row.workflow_request_id),
    requestNumber: row.request_number,

    userId: Number(row.user_id),
    employeeName: row.employee_name ?? row.username,
    username: row.username,

    statusCode: row.status_code,
    statusName: row.status_name,

    activity: row.activity,
    activityDate: row.activity_date,
    reason: row.reason,

    reviewedBy: row.reviewed_by === null ? null : Number(row.reviewed_by),

    reviewerName: row.reviewer_name,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatActivityDateForObservation(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "DATĂ NECUNOSCUTĂ";
    }

    return new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(value);
  }

  const normalizedValue = value.includes("T") ? value.slice(0, 10) : value;

  const [year, month, day] = normalizedValue.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}.${month}.${year}`;
}

function buildInactivityObservation(
  inactivity: Pick<InactivityRequest, "activity" | "activityDate">,
): string {
  return `INACTIVITATE PENTRU ${inactivity.activity
    .trim()
    .toUpperCase()} - ${formatActivityDateForObservation(
    inactivity.activityDate,
  )}`;
}

async function addInactivityObservationWithConnection(
  connection: PoolConnection,
  userId: number,
  inactivity: Pick<InactivityRequest, "activity" | "activityDate">,
): Promise<void> {
  const observation = buildInactivityObservation(inactivity);

  const [rows] = await connection.execute<
    (RowDataPacket & { observations: string | null })[]
  >(
    `
      SELECT observations
      FROM employee_details
      WHERE user_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [userId],
  );

  const employee = rows[0];

  if (!employee) {
    throw new Error("Employee details were not found.");
  }

  const currentObservations = employee.observations?.trim() ?? "";

  const lines = currentObservations
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.includes(observation)) {
    return;
  }

  const updatedObservations =
    currentObservations.length > 0
      ? `${currentObservations}\n${observation}`
      : observation;

  await connection.execute<ResultSetHeader>(
    `
      UPDATE employee_details
      SET observations = ?
      WHERE user_id = ?
    `,
    [updatedObservations, userId],
  );
}

async function removeInactivityObservationWithConnection(
  connection: PoolConnection,
  userId: number,
  inactivity: Pick<InactivityRequest, "activity" | "activityDate">,
): Promise<void> {
  const observation = buildInactivityObservation(inactivity);

  const [rows] = await connection.execute<
    (RowDataPacket & { observations: string | null })[]
  >(
    `
      SELECT observations
      FROM employee_details
      WHERE user_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [userId],
  );

  const employee = rows[0];

  if (!employee) {
    return;
  }

  const currentObservations = employee.observations?.trim() ?? "";

  if (!currentObservations) {
    return;
  }

  const updatedObservations = currentObservations
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== observation)
    .join("\n");

  await connection.execute<ResultSetHeader>(
    `
      UPDATE employee_details
      SET observations = ?
      WHERE user_id = ?
    `,
    [updatedObservations || null, userId],
  );
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

async function hasDuplicateInactivityWithConnection(
  connection: PoolConnection,
  userId: number,
  activity: string,
  activityDate: string,
): Promise<boolean> {
  const [rows] = await connection.execute<DuplicateInactivityRow[]>(
    `
      SELECT
        wr.id
      FROM workflow_requests wr

      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id

      INNER JOIN workflow_statuses ws
        ON ws.id = wr.status_id

      INNER JOIN inactivity_requests ir
        ON ir.workflow_request_id = wr.id

      WHERE wr.user_id = ?
        AND wt.code = 'INACTIVITY'
        AND ws.code IN ('PENDING', 'APPROVED')
        AND ir.activity_date = ?
        AND LOWER(TRIM(ir.activity)) = LOWER(TRIM(?))

      LIMIT 1
    `,
    [userId, activityDate, activity],
  );

  return rows.length > 0;
}

async function getInactivityByWorkflowIdWithConnection(
  connection: PoolConnection,
  workflowRequestId: number,
): Promise<InactivityRequest | null> {
  const [rows] = await connection.execute<InactivityRow[]>(
    `
      SELECT
        id,
        workflow_request_id,
        activity,
        activity_date,
        reason,
        created_at,
        updated_at
      FROM inactivity_requests
      WHERE workflow_request_id = ?
      LIMIT 1
    `,
    [workflowRequestId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapInactivity(rows[0]);
}

export async function getInactivityByWorkflowIdForUser(
  workflowRequestId: number,
  userId: number,
): Promise<InactivityRequest | null> {
  const [rows] = await db.execute<InactivityRow[]>(
    `
      SELECT
        ir.id,
        ir.workflow_request_id,
        ir.activity,
        ir.activity_date,
        ir.reason,
        ir.created_at,
        ir.updated_at
      FROM inactivity_requests ir
      INNER JOIN workflow_requests wr
        ON wr.id = ir.workflow_request_id
      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id
      WHERE ir.workflow_request_id = ?
        AND wr.user_id = ?
        AND wt.code = 'INACTIVITY'
      LIMIT 1
    `,
    [workflowRequestId, userId],
  );

  return rows[0] ? mapInactivity(rows[0]) : null;
}

export async function getInactivityByWorkflowIdForAdmin(
  workflowRequestId: number,
): Promise<InactivityRequest | null> {
  const [rows] = await db.execute<InactivityRow[]>(
    `
      SELECT
        ir.id,
        ir.workflow_request_id,
        ir.activity,
        ir.activity_date,
        ir.reason,
        ir.created_at,
        ir.updated_at
      FROM inactivity_requests ir
      INNER JOIN workflow_requests wr
        ON wr.id = ir.workflow_request_id
      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id
      WHERE ir.workflow_request_id = ?
        AND wt.code = 'INACTIVITY'
      LIMIT 1
    `,
    [workflowRequestId],
  );

  return rows[0] ? mapInactivity(rows[0]) : null;
}

export async function getInactivityById(
  inactivityId: number,
): Promise<InactivityRequest | null> {
  const [rows] = await db.execute<InactivityRow[]>(
    `
      SELECT
        id,
        workflow_request_id,
        activity,
        activity_date,
        reason,
        created_at,
        updated_at
      FROM inactivity_requests
      WHERE id = ?
      LIMIT 1
    `,
    [inactivityId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapInactivity(rows[0]);
}

export async function getInactivityRequestsForUser(
  userId: number,
): Promise<InactivityListItem[]> {
  const [rows] = await db.execute<InactivityListRow[]>(
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

        ir.activity,
        ir.activity_date,
        ir.reason,

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

      INNER JOIN inactivity_requests ir
        ON ir.workflow_request_id = wr.id

      INNER JOIN users u
        ON u.id = wr.user_id

      LEFT JOIN employee_contracts employee_contract
        ON employee_contract.user_id = wr.user_id

      LEFT JOIN employee_contracts reviewer_contract
        ON reviewer_contract.user_id = wr.reviewed_by

      WHERE wr.user_id = ?
        AND wt.code = 'INACTIVITY'

      ORDER BY
        wr.created_at DESC,
        wr.id DESC
    `,
    [userId],
  );

  return rows.map(mapInactivityListItem);
}

export async function getAllInactivityRequests(): Promise<
  InactivityListItem[]
> {
  const [rows] = await db.execute<InactivityListRow[]>(
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

        ir.activity,
        ir.activity_date,
        ir.reason,

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

      INNER JOIN inactivity_requests ir
        ON ir.workflow_request_id = wr.id

      INNER JOIN users u
        ON u.id = wr.user_id

      LEFT JOIN employee_contracts employee_contract
        ON employee_contract.user_id = wr.user_id

      LEFT JOIN employee_contracts reviewer_contract
        ON reviewer_contract.user_id = wr.reviewed_by

      WHERE wt.code = 'INACTIVITY'

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

  return rows.map(mapInactivityListItem);
}

export async function createInactivityRequest(
  input: CreateInactivityInput,
): Promise<InactivityRequestDetails> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const workflowType = await getWorkflowTypeByCode("INACTIVITY");

    if (!workflowType) {
      throw new Error("INACTIVITY workflow type is not configured.");
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
      throw new Error("Inactive users cannot create inactivity requests.");
    }

    if (employee.employee_status === "DEMISIONAT") {
      throw new Error("Resigned employees cannot create inactivity requests.");
    }

    const activity = input.activity.trim();
    const reason = input.reason.trim();

    if (!activity) {
      throw new Error("Activity is required.");
    }

    if (activity.length > 150) {
      throw new Error("Activity cannot exceed 150 characters.");
    }

    if (!reason) {
      throw new Error("Inactivity reason is required.");
    }

    if (reason.length > 1000) {
      throw new Error("Inactivity reason cannot exceed 1000 characters.");
    }

    const activityDate = new Date(`${input.activityDate}T00:00:00`);

    if (Number.isNaN(activityDate.getTime())) {
      throw new Error("Invalid activity date.");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (activityDate < today) {
      throw new Error("Activity date cannot be in the past.");
    }

    const hasDuplicate = await hasDuplicateInactivityWithConnection(
      connection,
      input.userId,
      activity,
      input.activityDate,
    );

    if (hasDuplicate) {
      throw new Error(
        "You already have a pending or approved inactivity request for this activity on this date.",
      );
    }

    const workflow = await createWorkflowRequest(connection, {
      workflowTypeId: workflowType.id,
      userId: input.userId,
      statusId: pendingStatus.id,
    });

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO inactivity_requests (
          workflow_request_id,
          activity,
          activity_date,
          reason
        )
        VALUES (?, ?, ?, ?)
      `,
      [workflow.id, activity, input.activityDate, reason],
    );

    const inactivityId = Number(result.insertId);

    await createWorkflowHistory(connection, {
      workflowRequestId: workflow.id,
      action: "CREATED",
      performedBy: input.userId,
      oldStatusId: null,
      newStatusId: pendingStatus.id,
      metadata: {
        activity,
        activityDate: input.activityDate,
      },
    });

    await connection.commit();

    const inactivity = await getInactivityById(inactivityId);

    if (!inactivity) {
      throw new Error("Inactivity request could not be loaded after creation.");
    }

    return {
      workflow,
      inactivity,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteOwnPendingInactivityRequest(
  workflowRequestId: number,
  userId: number,
): Promise<DeleteInactivityResult> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<
      (DeleteInactivityRow & { status_code: string })[]
    >(
      `
        SELECT
          wr.id AS workflow_request_id,
          wr.user_id,
          ws.code AS status_code
        FROM workflow_requests wr

        INNER JOIN workflow_types wt
          ON wt.id = wr.workflow_type_id

        INNER JOIN workflow_statuses ws
          ON ws.id = wr.status_id

        INNER JOIN inactivity_requests ir
          ON ir.workflow_request_id = wr.id

        WHERE wr.id = ?
          AND wr.user_id = ?
          AND wt.code = 'INACTIVITY'

        LIMIT 1
        FOR UPDATE
      `,
      [workflowRequestId, userId],
    );

    const inactivity = rows[0];

    if (!inactivity) {
      throw new Error("Cererea de inactivitate nu a fost găsită.");
    }

    if (inactivity.status_code !== "PENDING") {
      throw new Error(
        "Poți șterge doar cererile de inactivitate aflate în așteptare.",
      );
    }

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM workflow_request_history
        WHERE workflow_request_id = ?
      `,
      [workflowRequestId],
    );

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM inactivity_requests
        WHERE workflow_request_id = ?
      `,
      [workflowRequestId],
    );

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM workflow_requests
        WHERE id = ?
      `,
      [workflowRequestId],
    );

    await connection.commit();

    return {
      workflowRequestId: Number(inactivity.workflow_request_id),
      userId: Number(inactivity.user_id),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function approveInactivityRequest(
  workflowRequestId: number,
  adminId: number,
): Promise<InactivityRequestDetails> {
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

    const inactivity = await getInactivityByWorkflowIdWithConnection(
      connection,
      workflowRequestId,
    );

    if (!inactivity) {
      throw new Error("Inactivity request was not found.");
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
      throw new Error("Only pending inactivity requests can be approved.");
    }

    await updateWorkflowReview(connection, {
      workflowRequestId,
      statusId: approvedStatus.id,
      reviewedBy: adminId,
      rejectionReason: null,
    });

    /*
     * Inactivitatea per activitate nu modifică statusul angajatului.
     *
     * În momentul aprobării adăugăm direct în observații:
     *
     * INACTIVITATE PENTRU ȘEDINȚĂ - 10.08.2026
     *
     * Nu există sync și nu așteptăm data activității.
     */
    await addInactivityObservationWithConnection(
      connection,
      workflow.userId,
      inactivity,
    );

    await createWorkflowHistory(connection, {
      workflowRequestId,
      action: "APPROVED",
      performedBy: adminId,
      oldStatusId: pendingStatus.id,
      newStatusId: approvedStatus.id,
      metadata: {
        activity: inactivity.activity,
        activityDate: inactivity.activityDate,
      },
    });

    await connection.commit();

    const updatedWorkflow = await getWorkflowRequestById(workflowRequestId);

    const updatedInactivity =
      await getInactivityByWorkflowIdForAdmin(workflowRequestId);

    if (!updatedWorkflow || !updatedInactivity) {
      throw new Error("Approved inactivity request could not be loaded.");
    }

    return {
      workflow: updatedWorkflow,
      inactivity: updatedInactivity,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function rejectInactivityRequest(
  input: RejectInactivityInput,
): Promise<InactivityRequestDetails> {
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

    const inactivity = await getInactivityByWorkflowIdWithConnection(
      connection,
      input.workflowRequestId,
    );

    if (!inactivity) {
      throw new Error("Inactivity request was not found.");
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
      throw new Error("Only pending inactivity requests can be rejected.");
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
      metadata: {
        activity: inactivity.activity,
        activityDate: inactivity.activityDate,
      },
    });

    await connection.commit();

    const updatedWorkflow = await getWorkflowRequestById(
      input.workflowRequestId,
    );

    const updatedInactivity = await getInactivityByWorkflowIdForAdmin(
      input.workflowRequestId,
    );

    if (!updatedWorkflow || !updatedInactivity) {
      throw new Error("Rejected inactivity request could not be loaded.");
    }

    return {
      workflow: updatedWorkflow,
      inactivity: updatedInactivity,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteInactivityRequest(
  workflowRequestId: number,
): Promise<DeleteInactivityResult> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<
      (DeleteInactivityRow & { status_code: string })[]
    >(
      `
        SELECT
          wr.id AS workflow_request_id,
          wr.user_id,
          ws.code AS status_code
        FROM workflow_requests wr

        INNER JOIN workflow_types wt
          ON wt.id = wr.workflow_type_id

        INNER JOIN workflow_statuses ws
          ON ws.id = wr.status_id

        INNER JOIN inactivity_requests ir
          ON ir.workflow_request_id = wr.id

        WHERE wr.id = ?
          AND wt.code = 'INACTIVITY'

        LIMIT 1
        FOR UPDATE
      `,
      [workflowRequestId],
    );

    const request = rows[0];

    if (!request) {
      throw new Error("Cererea de inactivitate nu a fost găsită.");
    }

    const inactivity = await getInactivityByWorkflowIdWithConnection(
      connection,
      workflowRequestId,
    );

    if (!inactivity) {
      throw new Error("Datele cererii de inactivitate nu au fost găsite.");
    }

    /*
     * Dacă cererea fusese aprobată, ea a adăugat deja
     * observația în employee_details.
     *
     * La ștergerea cererii eliminăm doar observația
     * generată de această cerere.
     */
    if (request.status_code === "APPROVED") {
      await removeInactivityObservationWithConnection(
        connection,
        Number(request.user_id),
        inactivity,
      );
    }

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM workflow_request_history
        WHERE workflow_request_id = ?
      `,
      [workflowRequestId],
    );

    await connection.execute<ResultSetHeader>(
      `
        DELETE FROM inactivity_requests
        WHERE workflow_request_id = ?
      `,
      [workflowRequestId],
    );

    const [workflowDeleteResult] = await connection.execute<ResultSetHeader>(
      `
          DELETE FROM workflow_requests
          WHERE id = ?
        `,
      [workflowRequestId],
    );

    if (workflowDeleteResult.affectedRows !== 1) {
      throw new Error("Cererea de inactivitate nu a putut fi ștearsă.");
    }

    await connection.commit();

    return {
      workflowRequestId: Number(request.workflow_request_id),
      userId: Number(request.user_id),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
