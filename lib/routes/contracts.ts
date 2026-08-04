import { Router } from "express";
import type { RowDataPacket } from "mysql2";

import { db } from "../db";
import { requireAuth } from "../services/requireAuth";

const router = Router();

type ContractStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED";

interface ContractRow extends RowDataPacket {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  age: number;
  game_id: string;
  ci_series: string;
  phone_number: string;
  city_hours: number;
  identity_image_path: string;
  accepted_rules: number;
  employee_signature_name: string | null;
  status: ContractStatus;
  rejection_reason: string | null;
  contract_creation_blocked: number;
  signed_at: Date | null;
  approved_by_user_id: number | null;
  approved_by_name: string | null;
  admin_signature_path: string | null;
  approved_at: Date | null;
  rejected_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

router.get("/me", requireAuth, async (req, res) => {
  try {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Nu există o sesiune activă.",
      });
    }

    const [contracts] = await db.execute<ContractRow[]>(
      `
        SELECT
          id,
          user_id,
          first_name,
          last_name,
          age,
          game_id,
          ci_series,
          phone_number,
          city_hours,
          identity_image_path,
          accepted_rules,
          employee_signature_name,
          status,
          rejection_reason,
          contract_creation_blocked,
          signed_at,
          approved_by_user_id,
          approved_by_name,
          admin_signature_path,
          approved_at,
          rejected_at,
          created_at,
          updated_at
        FROM employee_contracts
        WHERE user_id = ?
        LIMIT 1
      `,
      [sessionUser.id],
    );

    const contract = contracts[0];

    if (!contract) {
      return res.status(200).json({
        success: true,
        contract: null,
        canCreateContract: sessionUser.role === "GUEST",
      });
    }

    return res.status(200).json({
      success: true,
      contract: {
        id: contract.id,
        userId: contract.user_id,
        firstName: contract.first_name,
        lastName: contract.last_name,
        age: contract.age,
        gameId: contract.game_id,
        ciSeries: contract.ci_series,
        phoneNumber: contract.phone_number,
        cityHours: contract.city_hours,
        identityImagePath: contract.identity_image_path,
        acceptedRules: Boolean(contract.accepted_rules),
        employeeSignatureName: contract.employee_signature_name,
        status: contract.status,
        rejectionReason: contract.rejection_reason,
        contractCreationBlocked: Boolean(contract.contract_creation_blocked),
        signedAt: contract.signed_at,
        approvedByUserId: contract.approved_by_user_id,
        approvedByName: contract.approved_by_name,
        adminSignaturePath: contract.admin_signature_path,
        approvedAt: contract.approved_at,
        rejectedAt: contract.rejected_at,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
      },
      canCreateContract:
        sessionUser.role === "GUEST" &&
        !contract.contract_creation_blocked &&
        ["DRAFT", "REJECTED"].includes(contract.status),
    });
  } catch (error) {
    console.error("Get own contract error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la încărcarea contractului.",
    });
  }
});

export default router;
