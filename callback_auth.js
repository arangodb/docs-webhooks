import { createHash, timingSafeEqual } from "node:crypto";

// The CI of docs-hugo authenticates its callbacks (check runs, pull requests) with
// a shared token in the docs-webhook-token header. It's the DOCS_WEBHOOK_TOKEN
// environment variable on both sides (CircleCI project, Netlify site).
export function isAuthorizedCallback(headers, secret) {
  if (!secret) return false
  const token = headers["docs-webhook-token"]
  if (typeof token !== "string" || token === "") return false
  // Hashes for the constant-time comparison, which needs equal lengths
  const digest = (value) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(token), digest(secret))
}
