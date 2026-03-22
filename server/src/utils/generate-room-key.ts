import { customAlphabet } from "nanoid"

/**
 * Generates a short, human-friendly room key, e.g. "XK9-A3B".
 * Uses an unambiguous alphabet (no I, O, 0, 1 etc.).
 */
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const nanoid = customAlphabet(alphabet, 7)

export function generateRoomKey(): string {
  const raw = nanoid()
  return `${raw.slice(0, 3)}-${raw.slice(3)}`
}
