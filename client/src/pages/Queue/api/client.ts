import { APIError } from "./errors/api_error";
import { ResponseError } from "./errors/response_error";
import { validateAddUser, validateCheckUser, validateLeadSubmission } from "./validators";

export const getAPIClient = (url:string) =>  ({
  addUser: async (queueId:string) => {
    const encodedQueueId = encodeURIComponent(queueId);
    const response = await fetch(`${url}/add_user?queue_id=${encodedQueueId}`);
    if (!response.ok) {
      const errorText  = await response.text();
      throw new APIError(errorText , response.status);
    }
    const json = await response.json();
    const result = validateAddUser(json);
    if(result.success) {
      return result.data;
    }
    console.error(result.error.message);
    throw new ResponseError("Failed to validate response");
    
  },
  checkUser: async (sessionId:number, sessionAuthId:string) => {
    const encodedSessionAuthId = encodeURIComponent(sessionAuthId);
    const encodedSessionId = encodeURIComponent(sessionId);
    const response = await fetch(`${url}/check_user?session_id=${encodedSessionId}&session_auth_id=${encodedSessionAuthId}`);
    if (!response.ok) {
      const errorText  = await response.text();
      throw new APIError(errorText , response.status);
    }
    const json = await response.json();
    const result = validateCheckUser(json);
    if(result.success) {
      return result.data;
    }
    console.error(result.error.message);
    throw new ResponseError("Failed to validate response");
  },
  addFeedback: async ({
    workerAuthId,
    sessionId,
    sessionAuthId,
    feedback,
    timestamp,
    email
  }:{
    workerAuthId:string;
    sessionId:number;
    sessionAuthId:string;
    feedback:0|1;
    timestamp:number;
    email:string;

  } ) => {
    const encodedWorkerAuthId = encodeURIComponent(workerAuthId);
    const encodedSessionAuthId = encodeURIComponent(sessionAuthId);
    const encodedSessionId = encodeURIComponent(sessionId);
    const encodedFeedback = encodeURIComponent(feedback);
    const encodedTimestamp = encodeURIComponent(timestamp);
    const encodedEmail = encodeURIComponent(email);
    const response = await fetch(`${url}/user_feedback?worker_auth_id=${encodedWorkerAuthId}&session_id=${encodedSessionId}&session_auth_id=${encodedSessionAuthId}&feedback=${encodedFeedback}&timestamp=${encodedTimestamp}&email=${encodedEmail}`);
    if (!response.ok) {
      const errorText  = await response.text();
      throw new APIError(errorText , response.status);
    }
    return response.json();
  },
  submitLead: async ({
    contractorId,
    contactType,
    contactValue,
    transcript,
    sessionMeta,
  }: {
    contractorId: string;
    contactType: "email" | "mobile";
    contactValue: string;
    transcript: string;
    sessionMeta: {
      started_at?: string | null;
      ended_at?: string | null;
      duration_seconds?: number | null;
      source_url?: string | null;
    };
  }) => {
    const response = await fetch(`${url}/lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contractor_id: contractorId,
        contact_type: contactType,
        contact_value: contactValue,
        transcript,
        session_meta: sessionMeta,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new APIError(errorText, response.status);
    }
    const json = await response.json();
    const result = validateLeadSubmission(json);
    if (result.success) {
      return result.data;
    }
    console.error(result.error.message);
    throw new ResponseError("Failed to validate lead response");
  }
});
