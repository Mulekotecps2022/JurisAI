import { z } from "zod";

export const documentCategorySchema = z.enum([
  "petition",
  "contract",
  "evidence",
  "decision",
  "certificate",
  "medical",
  "communication",
  "other"
]);

export const documentStatusSchema = z.enum(["received", "in_review", "reviewed"]);

export const documentInputSchema = z.object({
  title: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(240),
  caseId: z.string().trim().min(1, "Selecione um processo."),
  category: documentCategorySchema,
  fileName: z.string().trim().min(1, "Informe o nome do arquivo.").max(255),
  notes: z.string().trim().max(2000).optional(),
  status: documentStatusSchema.default("received")
});

export type DocumentCategory = z.infer<typeof documentCategorySchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type DocumentInput = z.infer<typeof documentInputSchema>;

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  petition: "Petição",
  contract: "Contrato",
  evidence: "Prova / evidência",
  decision: "Decisão judicial",
  certificate: "Certidão",
  medical: "Documento médico",
  communication: "Comunicação",
  other: "Outro"
};

export const documentStatusLabels: Record<DocumentStatus, string> = {
  received: "Recebido",
  in_review: "Em análise",
  reviewed: "Analisado"
};
