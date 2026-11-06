import { z } from "zod";
import { caseParticipantInputSchema } from "@/features/participants/domain";

export const caseInputSchema = z.object({
  title: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(240),
  description: z.string().trim().max(10000).optional(),
  participants: z.array(caseParticipantInputSchema).default([])
});

export type CaseInput = z.infer<typeof caseInputSchema>;

/**
 * Papéis de acesso ao processo, independentes dos papéis jurídicos
 * exercidos pelas pessoas participantes.
 */
export const caseAccessRoleSchema = z.enum(["owner", "editor", "viewer"]);
export type CaseAccessRole = z.infer<typeof caseAccessRoleSchema>;
