import { z } from "zod"

export const validateAddUser = (response: unknown) => {
  const AddUser = z.object({
    session_id: z.number(),
    session_auth_id: z.string(),
  });
  return AddUser.safeParse(response);
};

export const validateCheckUser = (response: unknown) => {
  const CheckUser = z.object({
    session_id: z.number(),
    // TODO: add more statuses
    status: z.enum(['wait', 'ready']),
    worker_auth_id: z.string().nullable(),
    worker_addr: z.string().nullable(),
    current_position: z.string(),
  });
  return CheckUser.safeParse(response);
}

export const validateLeadSubmission = (response: unknown) => {
  const LeadSubmission = z.object({
    ok: z.literal(true),
    qualified: z.boolean(),
    lead_id: z.string(),
  });
  return LeadSubmission.safeParse(response);
};
