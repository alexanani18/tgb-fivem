import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../db";

export interface UniformRow extends RowDataPacket {
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

const UNIFORM_COLUMNS = `
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
`;

export async function getUniforms() {
  const [rows] = await db.execute<UniformRow[]>(
    `
      SELECT
        ${UNIFORM_COLUMNS}
      FROM uniforms
      ORDER BY id ASC
    `,
  );

  return rows;
}

export async function getUniformById(id: number) {
  const [rows] = await db.execute<UniformRow[]>(
    `
      SELECT
        ${UNIFORM_COLUMNS}
      FROM uniforms
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ?? null;
}

interface UpdateUniformData {
  title: string;
  storeName: string;
  shoesRack: number;
  pantsRack: number;
  jacketRack: number;
  hatRack: number;
  updatedBy: number;
}

export async function updateUniform(
  id: number,
  data: UpdateUniformData,
) {
  await db.execute<ResultSetHeader>(
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
      data.title,
      data.storeName,
      data.shoesRack,
      data.pantsRack,
      data.jacketRack,
      data.hatRack,
      data.updatedBy,
      id,
    ],
  );

  return getUniformById(id);
}

interface UpdateUniformImageData {
  imagePath: string;
  updatedBy: number;
}

export async function updateUniformImage(
  id: number,
  data: UpdateUniformImageData,
) {
  await db.execute<ResultSetHeader>(
    `
      UPDATE uniforms
      SET
        image_path = ?,
        updated_by = ?
      WHERE id = ?
    `,
    [
      data.imagePath,
      data.updatedBy,
      id,
    ],
  );

  return getUniformById(id);
}