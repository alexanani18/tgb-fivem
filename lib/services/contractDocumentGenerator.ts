import fs from "node:fs/promises";
import path from "node:path";

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

interface GenerateContractDocumentOptions {
  documentNumber: string;
  versionNumber: number;

  userId: number;

  employeeName: string;
  gameId: string;
  phoneNumber: string;

  approvalDate: Date;

  rankName: string;
  salary: number;
  salaryType: "PUBLIC" | "CONFIDENTIAL";

  workSchedule: string;
  contractType: "UNLIMITED" | "FIXED";
  contractEndDate: Date | string | null;

  signatureName: string;
}

interface GeneratedContractFiles {
  pngPath: string;
  pdfPath: string;

  absolutePngPath: string;
  absolutePdfPath: string;
}

const CONTRACT_TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "img",
  "contract-empty.png",
);

const SIGNATURE_FONT_PATH = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Allura-Regular.ttf",
);

const GENERATED_CONTRACTS_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "generated-contracts",
);

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatSalary(
  salary: number,
  salaryType: "PUBLIC" | "CONFIDENTIAL",
): string {
  if (salaryType === "CONFIDENTIAL") {
    return "CONFIDENȚIAL";
  }

  return `${new Intl.NumberFormat("ro-RO").format(salary)}$/oră`;
}

function formatContractType(
  contractType: "UNLIMITED" | "FIXED",
  contractEndDate: Date | string | null,
): string {
  if (contractType === "UNLIMITED") {
    return "Nedeterminat";
  }

  if (!contractEndDate) {
    return "Determinat";
  }

  const parsedEndDate =
    contractEndDate instanceof Date
      ? contractEndDate
      : new Date(`${contractEndDate}T00:00:00`);

  if (Number.isNaN(parsedEndDate.getTime())) {
    return "Determinat";
  }

  return `Determinat până la ${formatDate(parsedEndDate)}`;
}

function getTextFontSize(value: string, defaultSize: number): number {
  if (value.length >= 30) {
    return defaultSize - 5;
  }

  if (value.length >= 24) {
    return defaultSize - 3;
  }

  if (value.length >= 18) {
    return defaultSize - 1;
  }

  return defaultSize;
}

function createTextElement(options: {
  value: string;
  x: number;
  y: number;
  width: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fill?: string;
  textAnchor?: "start" | "middle" | "end";
}): string {
  const {
    value,
    x,
    y,
    width,
    fontSize = 18,
    fontFamily = "Georgia",
    fontWeight = "600",
    fill = "#161616",
    textAnchor = "middle",
  } = options;

  const actualFontSize = getTextFontSize(value, fontSize);

  const textX =
    textAnchor === "middle"
      ? x + width / 2
      : textAnchor === "end"
        ? x + width
        : x;

  return `
    <text
      x="${textX}"
      y="${y}"
      font-family="${fontFamily}"
      font-size="${actualFontSize}"
      font-weight="${fontWeight}"
      fill="${fill}"
      text-anchor="${textAnchor}"
      dominant-baseline="middle"
    >
      ${escapeXml(value)}
    </text>
  `;
}

async function createOverlaySvg(
  options: GenerateContractDocumentOptions,
  templateWidth: number,
  templateHeight: number,
): Promise<Buffer> {
  const fontBuffer = await fs.readFile(SIGNATURE_FONT_PATH);
  const fontBase64 = fontBuffer.toString("base64");

  const employeeName = options.employeeName.trim();
  const signatureName = options.signatureName.trim() || employeeName;

  const approvalDate = formatDate(options.approvalDate);
  const rankName = options.rankName.trim();
  const salary = formatSalary(options.salary, options.salaryType);
  const workSchedule = options.workSchedule.trim();
  const contractType = formatContractType(
    options.contractType,
    options.contractEndDate,
  );

  const elements = [
    // Numărul contractului
    createTextElement({
      value: options.documentNumber,
      x: 504,
      y: 219,
      width: 174,
      fontSize: 16,
    }),

    // Data contractului
    createTextElement({
      value: approvalDate,
      x: 545,
      y: 249,
      width: 133,
      fontSize: 17,
    }),

    // Nume și prenume
    createTextElement({
      value: employeeName,
      x: 184,
      y: 439,
      width: 222,
      fontSize: 18,
    }),

    // CID
    createTextElement({
      value: options.gameId,
      x: 184,
      y: 465,
      width: 222,
      fontSize: 18,
    }),

    // Telefon
    createTextElement({
      value: options.phoneNumber,
      x: 184,
      y: 491,
      width: 222,
      fontSize: 18,
    }),

    // Adresă
    createTextElement({
      value: "Los Santos",
      x: 184,
      y: 517,
      width: 222,
      fontSize: 18,
    }),

    // Data angajării
    createTextElement({
      value: approvalDate,
      x: 184,
      y: 542,
      width: 222,
      fontSize: 18,
    }),

    // Funcția
    createTextElement({
      value: "Angajat Blackfold",
      x: 687,
      y: 439,
      width: 272,
      fontSize: 18,
    }),

    // Gradul
    createTextElement({
      value: rankName,
      x: 687,
      y: 465,
      width: 272,
      fontSize: 18,
    }),

    // Salariul
    createTextElement({
      value: salary,
      x: 687,
      y: 491,
      width: 272,
      fontSize: 18,
    }),

    // Programul de lucru
    createTextElement({
      value: workSchedule,
      x: 687,
      y: 517,
      width: 272,
      fontSize: 18,
    }),

    // Tipul contractului
    createTextElement({
      value: contractType,
      x: 687,
      y: 542,
      width: 272,
      fontSize: 18,
    }),

    // Numele angajatului din zona de semnare
    createTextElement({
      value: employeeName,
      x: 684,
      y: 1479,
      width: 154,
      fontSize: 13,
    }),

    // Data din zona de semnare
    createTextElement({
      value: approvalDate,
      x: 853,
      y: 1501,
      width: 104,
      fontSize: 14,
    }),

    // Semnătura angajatului
    createTextElement({
      value: signatureName,
      x: 684,
      y: 1505,
      width: 154,
      fontSize: 18,
      fontFamily: "Allura",
      fontWeight: "400",
      fill: "#17120b",
    }),
  ];

  const svg = `
    <svg
      width="${templateWidth}"
      height="${templateHeight}"
      viewBox="0 0 1024 1536"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>
        @font-face {
          font-family: "Allura";
          src: url("data:font/ttf;base64,${fontBase64}") format("truetype");
          font-weight: 400;
          font-style: normal;
        }
      </style>

      ${elements.join("\n")}
    </svg>
  `;

  return Buffer.from(svg);
}

async function generatePdfFromPng(
  pngBuffer: Buffer,
  outputPath: string,
): Promise<void> {
  const pdfDocument = await PDFDocument.create();

  const embeddedPng = await pdfDocument.embedPng(pngBuffer);

  const imageWidth = embeddedPng.width;
  const imageHeight = embeddedPng.height;

  const page = pdfDocument.addPage([imageWidth, imageHeight]);

  page.drawImage(embeddedPng, {
    x: 0,
    y: 0,
    width: imageWidth,
    height: imageHeight,
  });

  const pdfBytes = await pdfDocument.save();

  await fs.writeFile(outputPath, pdfBytes);
}

export async function generateContractDocument(
  options: GenerateContractDocumentOptions,
): Promise<GeneratedContractFiles> {
  await fs.access(CONTRACT_TEMPLATE_PATH);
  await fs.access(SIGNATURE_FONT_PATH);

  const userDirectory = path.join(
    GENERATED_CONTRACTS_DIRECTORY,
    String(options.userId),
  );

  await fs.mkdir(userDirectory, {
    recursive: true,
  });

  const safeDocumentNumber = options.documentNumber.replace(
    /[^a-zA-Z0-9-_]/g,
    "-",
  );

  const baseFileName = `${safeDocumentNumber}-v${options.versionNumber}`;

  const pngFileName = `${baseFileName}.png`;
  const pdfFileName = `${baseFileName}.pdf`;

  const absolutePngPath = path.join(userDirectory, pngFileName);
  const absolutePdfPath = path.join(userDirectory, pdfFileName);

  const templateImage = sharp(CONTRACT_TEMPLATE_PATH);
  const templateMetadata = await templateImage.metadata();

  const templateWidth = templateMetadata.width;
  const templateHeight = templateMetadata.height;

  if (!templateWidth || !templateHeight) {
    throw new Error(
      "Dimensiunile șablonului contractului nu au putut fi determinate.",
    );
  }

  const overlaySvg = await createOverlaySvg(
    options,
    templateWidth,
    templateHeight,
  );

  const pngBuffer = await templateImage
    .composite([
      {
        input: overlaySvg,
        top: 0,
        left: 0,
      },
    ])
    .png({
      quality: 100,
      compressionLevel: 9,
    })
    .toBuffer();

  await fs.writeFile(absolutePngPath, pngBuffer);

  try {
    await generatePdfFromPng(pngBuffer, absolutePdfPath);
  } catch (error) {
    await fs.rm(absolutePngPath, {
      force: true,
    });

    throw error;
  }

  const publicDirectory = path.join(process.cwd(), "public");

  const pngPath = `/${path
    .relative(publicDirectory, absolutePngPath)
    .replaceAll(path.sep, "/")}`;

  const pdfPath = `/${path
    .relative(publicDirectory, absolutePdfPath)
    .replaceAll(path.sep, "/")}`;

  return {
    pngPath,
    pdfPath,
    absolutePngPath,
    absolutePdfPath,
  };
}
