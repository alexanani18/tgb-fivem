interface GenerateContractNumberOptions {
  documentId: number;
  approvalDate: Date;
}

export function generateContractNumber({
  documentId,
  approvalDate,
}: GenerateContractNumberOptions): string {
  if (!Number.isInteger(documentId) || documentId <= 0) {
    throw new Error("ID-ul documentului nu este valid.");
  }

  if (Number.isNaN(approvalDate.getTime())) {
    throw new Error("Data aprobării nu este validă.");
  }

  const year = approvalDate.getFullYear();
  const paddedDocumentId = String(documentId).padStart(6, "0");

  return `TBFS-${year}-${paddedDocumentId}`;
}
