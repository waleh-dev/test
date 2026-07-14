// Vercel serverless function — POST /api/submit.
// Reuses the exact same logic as the local Bun server (server.ts) so the
// backend behaves identically in every environment.
import { handleSubmit } from '../server';

// The `postgres` driver needs Node's tls/crypto, so use the Node.js runtime
// (not the Edge runtime).
export const config = { runtime: 'nodejs' };

// Give the DB time to wake up (Render free tier spins down when idle, so the
// first connection can take ~20–30s). Hobby allows up to 60s for Node fns.
export const maxDuration = 60;

export default function (req: Request): Promise<Response> {
  return handleSubmit(req);
}
