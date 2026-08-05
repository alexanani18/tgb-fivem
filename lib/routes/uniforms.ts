import { Router } from "express";
import type { RowDataPacket } from "mysql2";

import { db } from "../db";
import { requireEmployee } from "../services/requireEmployee";
import { requireAdmin } from "../services/requireAdmin";
import fs from "node:fs";
import path from "node:path";

import multer from "multer";

const router = Router();

const MAX_UNIFORM_IMAGE_SIZE = 5 * 1024 * 1024;

const allowedUniformImageTypes = [
  "image/jpeg",
  "image/png",
] as const;

const uniformImageStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    const directory = path.join(
      process.cwd(),
      "public",
      "uniforms",
    );

    fs.mkdirSync(directory, {
      recursive: true,
    });

    callback(null, directory);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniformId = req.params.id;

    callback(null, `uniform-${uniformId}${extension}`);
  },
});

const uniformImageUpload = multer({
  storage: uniformImageStorage,

  limits: {
    fileSize: MAX_UNIFORM_IMAGE_SIZE,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    const isAllowedType = allowedUniformImageTypes.includes(
      file.mimetype as (typeof allowedUniformImageTypes)[number],
    );

    if (!isAllowedType) {
      return callback(
        new Error("Imaginea trebuie să fie în format JPG sau PNG."),
      );
    }

    callback(null, true);
  },
});

interface UniformRow extends RowDataPacket {
  id: number;
  type: "MALE" | "FEMALE";
  title: string;
  image_path: string | null;
  store_name: string;
  shoes_rack: number;
  pants_rack: number;
  jacket_rack: number;
  hat_rack: number;
  updated_by: number | null;
  updated_at: Date;
}

function parseRack(value: unknown): number | null {
  const rack = Number(value);

  if (!Number.isInteger(rack) || rack <= 0) {
    return null;
  }

  return rack;
}

function validateTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const title = value.trim();

  if (!title || title.length > 100) {
    return null;
  }

  return title;
}

function validateStoreName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const storeName = value.trim();

  if (!storeName || storeName.length > 100) {
    return null;
  }

  return storeName;
}

/*
|--------------------------------------------------------------------------
| GET /api/uniforms
|--------------------------------------------------------------------------
|
| Toți utilizatorii autentificați cu rol diferit de GUEST.
|
*/

router.get("/", requireEmployee, async (_req, res) => {
  try {
    const [uniforms] = await db.execute<UniformRow[]>(
      `
        SELECT
          id,
          type,
          title,
          image_path,
          store_name,
          shoes_rack,
          pants_rack,
          jacket_rack,
          hat_rack,
          updated_by,
          updated_at
        FROM uniforms
        ORDER BY id ASC
      `,
    );

    return res.status(200).json({
      success: true,
      uniforms,
    });
  } catch (error) {
    console.error("❌ Failed to load uniforms:", error);

    return res.status(500).json({
      success: false,
      message: "Uniformele nu au putut fi încărcate.",
    });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const uniformId = Number(req.params.id);
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Nu există o sesiune activă.",
      });
    }

    if (!Number.isInteger(uniformId) || uniformId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul uniformei este invalid.",
      });
    }

    const title = validateTitle(req.body.title);
    const storeName = validateStoreName(req.body.storeName);

    const shoesRack = parseRack(req.body.shoesRack);
    const pantsRack = parseRack(req.body.pantsRack);
    const jacketRack = parseRack(req.body.jacketRack);
    const hatRack = parseRack(req.body.hatRack);

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Titlul este obligatoriu.",
      });
    }

    if (!storeName) {
      return res.status(400).json({
        success: false,
        message: "Magazinul este obligatoriu.",
      });
    }

    if (
      shoesRack === null ||
      pantsRack === null ||
      jacketRack === null ||
      hatRack === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Toate rafturile trebuie să fie valori numerice valide.",
      });
    }

    const [uniforms] = await db.execute<UniformRow[]>(
      `
        SELECT
          id,
          type,
          title,
          image_path,
          store_name,
          shoes_rack,
          pants_rack,
          jacket_rack,
          hat_rack,
          updated_by,
          updated_at
        FROM uniforms
        WHERE id = ?
        LIMIT 1
      `,
      [uniformId],
    );

    if (uniforms.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Uniforma nu există.",
      });
    }

    await db.execute(
      `
    UPDATE uniforms
    SET
      title = ?,
      store_name = ?,
      shoes_rack = ?,
      pants_rack = ?,
      jacket_rack = ?,
      hat_rack = ?,
      updated_by = ?
    WHERE id = ?
  `,
      [
        title,
        storeName,
        shoesRack,
        pantsRack,
        jacketRack,
        hatRack,
        sessionUser.id,
        uniformId,
      ],
    );

    const [updatedUniforms] = await db.execute<UniformRow[]>(
      `
    SELECT
      id,
      type,
      title,
      image_path,
      store_name,
      shoes_rack,
      pants_rack,
      jacket_rack,
      hat_rack,
      updated_by,
      updated_at
    FROM uniforms
    WHERE id = ?
    LIMIT 1
  `,
      [uniformId],
    );

    return res.status(200).json({
      success: true,
      message: "Uniforma a fost actualizată.",
      uniform: updatedUniforms[0],
    });
  } catch (error) {
    console.error("Failed to update uniform:", error);

    return res.status(500).json({
      success: false,
      message: "Uniforma nu a putut fi actualizată.",
    });
  }
});

router.patch(
  "/:id/image",
  requireAdmin,
  uniformImageUpload.single("image"),
  async (req, res) => {
    try {
      const uniformId = Number(req.params.id);
      const sessionUser = req.session.user;

      if (!sessionUser) {
        return res.status(401).json({
          success: false,
          message: "Nu există o sesiune activă.",
        });
      }

      if (!Number.isInteger(uniformId) || uniformId <= 0) {
        return res.status(400).json({
          success: false,
          message: "ID-ul uniformei este invalid.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Imaginea este obligatorie.",
        });
      }

      const [uniforms] = await db.execute<UniformRow[]>(
        `
          SELECT
            id,
            type,
            title,
            image_path,
            store_name,
            shoes_rack,
            pants_rack,
            jacket_rack,
            hat_rack,
            updated_by,
            updated_at
          FROM uniforms
          WHERE id = ?
          LIMIT 1
        `,
        [uniformId],
      );

      if (uniforms.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Uniforma nu există.",
        });
      }

      const imagePath = `uniforms/${req.file.filename}`;

      await db.execute(
        `
    UPDATE uniforms
    SET
      image_path = ?,
      updated_by = ?
    WHERE id = ?
  `,
        [
          imagePath,
          sessionUser.id,
          uniformId,
        ],
      );

      const [updatedUniforms] = await db.execute<UniformRow[]>(
        `
    SELECT
      id,
      type,
      title,
      image_path,
      store_name,
      shoes_rack,
      pants_rack,
      jacket_rack,
      hat_rack,
      updated_by,
      updated_at
    FROM uniforms
    WHERE id = ?
    LIMIT 1
  `,
        [uniformId],
      );

      return res.status(200).json({
        success: true,
        message: "Imaginea uniformei a fost actualizată.",
        uniform: updatedUniforms[0],
      });
    } catch (error) {
      console.error("Failed to upload uniform image:", error);

      return res.status(500).json({
        success: false,
        message: "Imaginea nu a putut fi încărcată.",
      });
    }
  },
);

export default router;