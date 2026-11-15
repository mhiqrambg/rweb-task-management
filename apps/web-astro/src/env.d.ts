declare namespace App {
  interface Locals {
    /** Result of GET /auth/me for this request, resolved once in middleware. */
    session: import('@taskapp/contracts').SessionProbe | null;
    /** Monotonic request id used in structured logs (NFR-OBS-002). */
    requestId: string;
    /**
     * Submitted form fields of a non-JS action request, echoed back so a validation error does
     * not clear what the person typed. Always empty on GET and on file-only submissions.
     */
    formValues: Record<string, string>;
  }
}
