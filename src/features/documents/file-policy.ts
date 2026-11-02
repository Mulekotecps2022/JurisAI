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
