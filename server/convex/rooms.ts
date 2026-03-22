import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

// ── Create ────────────────────────────────────────────────────────────────────
export const createRoom = mutation({
  args: {
    roomId: v.string(),
    roomKey: v.string(),
    hostId: v.string(),
  },
  handler: async (ctx, { roomId, roomKey, hostId }) => {
    await ctx.db.insert("rooms", {
      roomId,
      roomKey,
      hostId,
      guestId: undefined,
      currentVideoUrl: undefined,
      isPlaying: false,
      currentTime: 0,
      createdAt: Date.now(),
    })
  },
})

// ── Queries ───────────────────────────────────────────────────────────────────
export const getRoomById = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    return ctx.db
      .query("rooms")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .unique()
  },
})

export const getRoomByKey = query({
  args: { roomKey: v.string() },
  handler: async (ctx, { roomKey }) => {
    return ctx.db
      .query("rooms")
      .withIndex("by_roomKey", (q) => q.eq("roomKey", roomKey))
      .unique()
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────
export const updateGuest = mutation({
  args: { roomId: v.string(), guestId: v.string() },
  handler: async (ctx, { roomId, guestId }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .unique()
    if (!room) return
    await ctx.db.patch(room._id, { guestId })
  },
})

export const updateVideoState = mutation({
  args: {
    roomId: v.string(),
    currentVideoUrl: v.union(v.string(), v.null()),
    isPlaying: v.boolean(),
    currentTime: v.number(),
  },
  handler: async (ctx, { roomId, currentVideoUrl, isPlaying, currentTime }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .unique()
    if (!room) return
    await ctx.db.patch(room._id, {
      currentVideoUrl: currentVideoUrl ?? undefined,
      isPlaying,
      currentTime,
    })
  },
})

export const deleteRoom = mutation({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .unique()
    if (room) await ctx.db.delete(room._id)
  },
})
