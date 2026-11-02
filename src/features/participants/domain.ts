import { z } from "zod";

/**
 * Papéis de uma pessoa/entidade dentro de um processo.
 * O papel pertence ao vínculo com o processo, não ao cadastro global da pessoa.
 */
export const participantRoleSchema = z.enum([
  "client",
  "plaintiff",
  "defendant",
  "lawyer",
  "responsible",
  "partner",
  "witness",
  "expert",
  "other"
]);

export const personKindSchema = z.enum(["individual", "organization"]);

export const personInputSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(180),
  kind: personKindSchema.default("individual"),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  phone: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(4000).optional()
});

export const caseParticipantInputSchema = z.object({
  personId: z.string().uuid(),
  role: participantRoleSchema,
  roleDescription: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(2000).optional()
});

export type ParticipantRole = z.infer<typeof participantRoleSchema>;
export type PersonKind = z.infer<typeof personKindSchema>;
export type PersonInput = z.infer<typeof personInputSchema>;
export type CaseParticipantInput = z.infer<typeof caseParticipantInputSchema>;

export const participantRoleLabels: Record<ParticipantRole, string> = {
  client: "Cliente",
  plaintiff: "Parte autora",
  defendant: "Parte ré / contraparte",
  lawyer: "Advogado(a)",
  responsible: "Responsável",
  partner: "Parceiro(a) / correspondente",
  witness: "Testemunha",
  expert: "Perito(a) / assistente técnico(a)",
  other: "Outro"
};

export const personKindLabels: Record<PersonKind, string> = {
  individual: "Pessoa física",
  organization: "Pessoa jurídica"
};
