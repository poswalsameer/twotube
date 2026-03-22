import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  rooms: defineTable({
    roomId: v.string(),
    roomKey: v.string(),
    hostId: v.string(),
    guestId: v.optional(v.string()),
    currentVideoUrl: v.optional(v.string()),
    isPlaying: v.boolean(),
    currentTime: v.number(),
    createdAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomKey", ["roomKey"]),

  messages: defineTable({
    roomId: v.string(),
    senderId: v.string(),
    text: v.string(),
    timestamp: v.number(),
  }).index("by_roomId", ["roomId"]),

  queue: defineTable({
    roomId: v.string(),
    videoUrl: v.string(),
    addedBy: v.string(),
    order: v.number(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_order", ["roomId", "order"]),
})
