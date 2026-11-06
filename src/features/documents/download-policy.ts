/**
 * Fail-closed gate. Only the scanner-approved state may reach privileged
 * Storage signing, and only in the designated private bucket.
 */
export function canSignDocumentDownload(document: {
  status: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
}): boolean {
  return document.status === "available" &&
    document.storage_bucket === "case-documents" &&
    typeof document.storage_path === "string" &&
    document.storage_path.trim().length > 0 &&
    !document.storage_path.startsWith("/") &&
    !/[\\\\\\x00-\\x1f\\x7f]/.test(document.storage_path) &&
    !document.storage_path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}
