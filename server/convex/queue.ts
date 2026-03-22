import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const addToQueue = mutation({
  args: {
    roomId: v.string(),
    videoUrl: v.string(),
    addedBy: v.string(),
  },
  handler: async (ctx, { roomId, videoUrl, addedBy }) => {
    // Determine next order value
    const existing = await ctx.db
      .query("queue")
      .withIndex("by_roomId_order", (q) => q.eq("roomId", roomId))
      .order("desc")
      .first()

    const order = existing ? existing.order + 1 : 0

    return ctx.db.insert("queue", { roomId, videoUrl, addedBy, order })
  },
})

export const getQueue = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    return ctx.db
      .query("queue")
      .withIndex("by_roomId_order", (q) => q.eq("roomId", roomId))
      .order("asc")
      .collect()
  },
})

export const removeFirst = mutation({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const first = await ctx.db
      .query("queue")
      .withIndex("by_roomId_order", (q) => q.eq("roomId", roomId))
      .order("asc")
      .first()
    if (first) await ctx.db.delete(first._id)
  },
})

export const deleteQueueByRoom = mutation({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const items = await ctx.db
      .query("queue")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .collect()
    await Promise.all(items.map((item) => ctx.db.delete(item._id)))
  },
})
