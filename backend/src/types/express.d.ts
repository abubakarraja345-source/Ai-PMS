/**
 * The raw request body Buffer, captured by express.json()'s `verify`
 * callback in app.ts — needed for webhook signature verification
 * (e.g. WhatsApp's X-Hub-Signature-256), which must hash the exact
 * bytes Meta signed, not a re-serialization of the parsed JSON.
 */
declare namespace Express {
  export interface Request {
    rawBody?: Buffer;
  }
}
