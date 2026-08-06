import { db } from "../db";

import { generateContractDocument } from "./contractDocumentGenerator";
import { generateContractNumber } from "./contractNumber";

import type { RowDataPacket } from "mysql2";

interface ContractRow extends RowDataPacket {
  id: number;

  user_id: number;

  first_name: string;
  last_name: string;

  game_id: string;
  phone_number: string;

  employee_signature_name: string | null;

  approved_at: Date | null;

  approved_by_name: string | null;

  work_schedule: string | null;
  contract_type: "UNLIMITED" | "FIXED" | null;
  contract_end_date: Date | string | null;

  status: string;
}

interface UserRow extends RowDataPacket {
  id: number;

  username: string;

  user_rank_id: number | null;
}

type SalaryType = "PUBLIC" | "CONFIDENTIAL";

interface RankRow extends RowDataPacket {
  id: number;

  name: string;

  salary: number;

  salary_type: SalaryType;
}

interface EmployeeDocument {
  id: number;
  document_number: string;
  current_version: number;
}

interface EmployeeDocumentRow extends RowDataPacket, EmployeeDocument {}

export interface GenerateEmployeeContractResult {
  success: boolean;
  message: string;

  documentNumber?: string;
  versionNumber?: number;

  pngPath?: string;
  pdfPath?: string;
}

export async function generateEmployeeContract(
  contractId: number,
  generatedByUserId: number,
): Promise<GenerateEmployeeContractResult> {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    /**
     * PASUL 1
     * Luăm contractul
     */

    const [contractRows] = await connection.query<ContractRow[]>(
      `
    SELECT
      id,
      user_id,
      first_name,
      last_name,
      game_id,
      phone_number,
      employee_signature_name,
      approved_at,
      approved_by_name,
      work_schedule,
      contract_type,
      contract_end_date,
      status
    FROM employee_contracts
    WHERE id = ?
    LIMIT 1
  `,
      [contractId],
    );

    const contract = contractRows[0];

    if (!contract) {
      await connection.rollback();

      return {
        success: false,
        message: "Contractul nu există.",
      };
    }

    if (contract.status !== "APPROVED") {
      await connection.rollback();

      return {
        success: false,
        message: "Contractul nu este aprobat.",
      };
    }

    /**
     * PASUL 2
     * Luăm utilizatorul si rank-ul
     */
    const [userRows] = await connection.query<UserRow[]>(
      `
    SELECT
      id,
      username,
      user_rank_id
    FROM users
    WHERE id = ?
    LIMIT 1
  `,
      [contract.user_id],
    );

    const user = userRows[0];

    if (!user) {
      throw new Error("Utilizatorul asociat contractului nu există.");
    }

    if (!user.user_rank_id) {
      throw new Error("Utilizatorul nu are un grad Blackfold atribuit.");
    }

    const [rankRows] = await connection.query<RankRow[]>(
      `
    SELECT
      id,
      name,
      salary,
      salary_type
    FROM user_ranks
    WHERE id = ?
    LIMIT 1
  `,
      [user.user_rank_id],
    );

    const rank = rankRows[0];

    if (!rank) {
      throw new Error("Gradul utilizatorului nu există.");
    }

    if (!contract.approved_at) {
      throw new Error("Contractul nu are data aprobării salvată.");
    }

    if (!contract.employee_signature_name?.trim()) {
      throw new Error("Contractul nu are semnătura angajatului.");
    }

    if (!contract.work_schedule?.trim()) {
      throw new Error("Contractul nu are programul de lucru configurat.");
    }

    if (
      contract.contract_type !== "UNLIMITED" &&
      contract.contract_type !== "FIXED"
    ) {
      throw new Error("Tipul contractului nu este configurat corect.");
    }

    if (contract.contract_type === "FIXED" && !contract.contract_end_date) {
      throw new Error(
        "Contractul determinat nu are data expirării configurată.",
      );
    }

    if (
      rank.salary_type === "PUBLIC" &&
      (!Number.isInteger(rank.salary) || rank.salary <= 0)
    ) {
      throw new Error("Salariul public al gradului nu este configurat corect.");
    }

    if (rank.salary_type !== "PUBLIC" && rank.salary_type !== "CONFIDENTIAL") {
      throw new Error("Tipul salariului gradului nu este configurat corect.");
    }

    /**
     * PASUL 4
     * Creăm employee_documents
     */
    const [documentRows] = await connection.query<EmployeeDocumentRow[]>(
      `
      SELECT
        id,
        document_number,
        current_version
      FROM employee_documents
      WHERE contract_id = ?
      LIMIT 1
    `,
      [contract.id],
    );

    let document: EmployeeDocument | undefined = documentRows[0];

    if (!document) {
      const [insertResult] = await connection.query(
        `
      INSERT INTO employee_documents (
        user_id,
        contract_id
      )
      VALUES (?, ?)
    `,
        [contract.user_id, contract.id],
      );

      const documentId = (insertResult as { insertId: number }).insertId;

      const documentNumber = generateContractNumber({
        documentId,
        approvalDate: contract.approved_at,
      });

      await connection.query(
        `
      UPDATE employee_documents
      SET document_number = ?
      WHERE id = ?
    `,
        [documentNumber, documentId],
      );

      document = {
        id: documentId,
        document_number: documentNumber,
        current_version: 0,
      };
    }

    const nextVersion = document.current_version + 1;

    /**
     * PASUL 5
     * Generăm PNG + PDF
     */

    const employeeName = `${contract.first_name} ${contract.last_name}`.trim();

    const generatedFiles = await generateContractDocument({
      documentNumber: document.document_number,
      versionNumber: nextVersion,
      userId: contract.user_id,
      employeeName,
      gameId: contract.game_id,
      phoneNumber: contract.phone_number,
      approvalDate: contract.approved_at,
      rankName: rank.name,
      salary: rank.salary,
      salaryType: rank.salary_type,
      workSchedule: contract.work_schedule,
      contractType: contract.contract_type,
      contractEndDate: contract.contract_end_date,
      signatureName: contract.employee_signature_name,
    });

    /**
     * PASUL 6
     * Salvăm versiunea
     */

    const generatedByName = contract.approved_by_name?.trim() || user.username;

    await connection.query(
      `
    INSERT INTO employee_document_versions (
      document_id,
      version_number,
      png_path,
      pdf_path,
      employee_name,
      game_id,
      phone_number,
      employee_address,
      employment_date,
      job_title,
      rank_name,
      salary,
      work_schedule,
      contract_type,
      signature_name,
      generated_by_user_id,
      generated_by_name
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      'Los Santos',
      ?,
      'Angajat Blackfold',
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )
  `,
      [
        document.id,
        nextVersion,
        generatedFiles.pngPath,
        generatedFiles.pdfPath,
        employeeName,
        contract.game_id,
        contract.phone_number,
        contract.approved_at,
        rank.name,
        rank.salary,
        contract.work_schedule,
        contract.contract_type === "FIXED" ? "Determinat" : "Nedeterminat",
        contract.employee_signature_name,
        generatedByUserId,
        generatedByName,
      ],
    );

    await connection.query(
      `
    UPDATE employee_documents
    SET
      current_version = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
      [nextVersion, document.id],
    );

    await connection.commit();

    return {
      success: true,
      message:
        nextVersion === 1
          ? "Contractul a fost generat cu succes."
          : `Contractul a fost regenerat cu succes. Versiunea ${nextVersion} a fost creată.`,
      documentNumber: document.document_number,
      versionNumber: nextVersion,
      pngPath: generatedFiles.pngPath,
      pdfPath: generatedFiles.pdfPath,
    };
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}
