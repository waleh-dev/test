// Vercel serverless function — POST /api/submit.
// Reuses the exact same logic as the local Bun server (server.ts) so the
// backend behaves identically in every environment.
import { handleSubmit } from '../server';

// The `postgres` driver needs Node's tls/crypto, so use the Node.js runtime
// (not the Edge runtime).
export const config = { runtime: 'nodejs' };

export default function (req: Request): Promise<Response> {
  return handleSubmit(req);
}
