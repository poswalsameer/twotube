import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const sendMessage = mutation({
  args: {
    roomId: v.string(),
    senderId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { roomId, senderId, text }) => {
    return ctx.db.insert("messages", {
      roomId,
      senderId,
      text,
      timestamp: Date.now(),
    })
  },
})

export const getMessages = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    return ctx.db
      .query("messages")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .order("asc")
      .collect()
  },
})

export const deleteMessagesByRoom = mutation({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
      .collect()
    await Promise.all(messages.map((m) => ctx.db.delete(m._id)))
  },
})
