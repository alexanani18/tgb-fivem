import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { db } from "../db";

interface ActiveLeaveRow extends RowDataPacket {
  user_id: number;
  start_date: string;
  end_date: string;
}

interface EmployeeOnLeaveRow extends RowDataPacket {
  user_id: number;
}

export interface LeaveStatusSyncResult {
  activated: number;
  finished: number;
}

async function getEmployeesWithActiveLeave(): Promise<ActiveLeaveRow[]> {
  const [rows] = await db.execute<ActiveLeaveRow[]>(
    `
      SELECT
        wr.user_id,
        DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date
      FROM workflow_requests wr

      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id

      INNER JOIN workflow_statuses ws
        ON ws.id = wr.status_id

      INNER JOIN leave_requests lr
        ON lr.workflow_request_id = wr.id

      INNER JOIN users u
        ON u.id = wr.user_id

      WHERE wt.code = 'LEAVE'
        AND ws.code = 'APPROVED'
        AND lr.start_date <= CURDATE()
        AND lr.end_date >= CURDATE()
        AND u.is_active = 1

      ORDER BY
        wr.user_id ASC,
        lr.start_date DESC,
        wr.id DESC
    `,
  );

  return rows;
}

async function getEmployeesCurrentlyMarkedOnLeave(): Promise<
  EmployeeOnLeaveRow[]
> {
  const [rows] = await db.execute<EmployeeOnLeaveRow[]>(
    `
      SELECT
        user_id
      FROM employee_details
      WHERE status = 'CONCEDIU'
    `,
  );

  return rows;
}

async function setEmployeeOnLeave(
  userId: number,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const observation =
    `Concediu din ${formatDateForObservation(startDate)} ` +
    `până în ${formatDateForObservation(endDate)}`;

  const [result] = await db.execute<ResultSetHeader>(
    `
      UPDATE employee_details
      SET
        status = 'CONCEDIU',
        observations = ?
      WHERE user_id = ?
        AND (
          status <> 'CONCEDIU'
          OR observations <> ?
          OR observations IS NULL
        )
    `,
    [observation, userId, observation],
  );

  return result.affectedRows > 0;
}

async function setEmployeeActive(userId: number): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `
      UPDATE employee_details
      SET
        status = 'ACTIV',
        observations = NULL
      WHERE user_id = ?
        AND status = 'CONCEDIU'
    `,
    [userId],
  );

  return result.affectedRows > 0;
}

function formatDateForObservation(value: string): string {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export async function syncEmployeeLeaveStatuses(): Promise<LeaveStatusSyncResult> {
  const activeLeaves = await getEmployeesWithActiveLeave();

  /*
   * Poate exista teoretic mai mult de un concediu activ pentru același user
   * dacă datele au fost modificate manual.
   *
   * Păstrăm un singur concediu per user pentru statusul curent.
   */
  const activeLeaveByUser = new Map<number, ActiveLeaveRow>();

  for (const leave of activeLeaves) {
    if (!activeLeaveByUser.has(Number(leave.user_id))) {
      activeLeaveByUser.set(Number(leave.user_id), leave);
    }
  }

  let activated = 0;

  for (const [userId, leave] of activeLeaveByUser) {
    const changed = await setEmployeeOnLeave(
      userId,
      leave.start_date,
      leave.end_date,
    );

    if (changed) {
      activated += 1;
    }
  }

  const employeesOnLeave = await getEmployeesCurrentlyMarkedOnLeave();

  let finished = 0;

  for (const employee of employeesOnLeave) {
    const userId = Number(employee.user_id);

    if (activeLeaveByUser.has(userId)) {
      continue;
    }

    const changed = await setEmployeeActive(userId);

    if (changed) {
      finished += 1;
    }
  }

  return {
    activated,
    finished,
  };
}
