import { ConvexHttpClient } from "convex/browser"

if (!process.env.CONVEX_URL) {
  throw new Error("CONVEX_URL environment variable is not set.")
}

/**
 * Shared Convex HTTP client singleton.
 */
export const convex = new ConvexHttpClient(process.env.CONVEX_URL)
