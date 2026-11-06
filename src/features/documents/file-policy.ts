import { z } from "zod";

export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export const allowedDocumentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "message/rfc822"
] as const;

export const documentFileMetadataSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(DOCUMENT_MAX_BYTES),
  type: z.enum(allowedDocumentMimeTypes)
});

const uuidSchema = z.string().uuid();
const safeExtensionSchema = z.enum([
  "pdf", "jpg", "jpeg", "png", "tif", "tiff", "doc", "docx", "xls", "xlsx", "txt", "eml"
]);

/**
 * Produces an opaque Storage object key. The original filename is kept only
 * as document metadata; it is never used as a path segment.
 */
export function buildDocumentObjectPath(input: {
  caseId: string;
  documentId: string;
  extension: string;
}) {
  const caseId = uuidSchema.parse(input.caseId);
  const documentId = uuidSchema.parse(input.documentId);
  const extension = safeExtensionSchema.parse(input.extension.toLowerCase());

  return `${caseId}/${documentId}/original.${extension}`;
}

export const documentExtensionMimeMap: Record<string, (typeof allowedDocumentMimeTypes)[number]> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  eml: "message/rfc822"
};

export function getDocumentExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Preliminary signature check only. Office Open XML formats are ZIP
 * containers; a PK header does not prove a valid or safe OOXML document.
 * Every accepted file must remain quarantined until malware scanning.
 */
export function hasAllowedDocumentSignature(bytes: Uint8Array, mime: string) {
  const starts = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);

  switch (mime) {
    case "application/pdf":
      return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/tiff":
      return starts(0x49, 0x49, 0x2a, 0x00) || starts(0x4d, 0x4d, 0x00, 0x2a);
    case "application/msword":
    case "application/vnd.ms-excel":
      return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return starts(0x50, 0x4b, 0x03, 0x04);
    case "text/plain":
    case "message/rfc822":
      try {
        return !new TextDecoder("utf-8", { fatal: true })
          .decode(bytes)
          .includes("\u0000");
      } catch {
        return false;
      }
    default:
      return false;
  }
}
