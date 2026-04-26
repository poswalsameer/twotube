import { Socket, Server } from "socket.io"
import { queueService } from "../services/queue.service"
import { SERVER_EVENTS } from "../constants/events"

export const queueController = {
  async addToQueue(
    payload: { userId: string; roomId: string; videoUrl: string },
    socket: Socket,
    io: Server
  ) {
    try {
      const { userId, roomId, videoUrl } = payload

      if (!userId || !roomId || !videoUrl) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "userId, roomId, and videoUrl are required." })
        return
      }

      const res = await queueService.addToQueue({ userId, roomId, videoUrl })

      if (!res.success || !res.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: res.message })
        return
      }

      io.to(roomId).emit(SERVER_EVENTS.QUEUE_UPDATED, { queue: res.data })

      console.log(`[queue-controller] ${userId} added to queue in room ${roomId}`)
    } catch (err: unknown) {
      console.error("[queue-controller] addToQueue:", err)
      const message = err instanceof Error ? err.message : "Failed to add to queue."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },

  async nextVideo(
    payload: { userId: string; roomId: string },
    socket: Socket,
    io: Server
  ) {
    try {
      const { userId, roomId } = payload

      if (!userId || !roomId) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "userId and roomId are required." })
        return
      }

      const res = await queueService.nextVideo({ userId, roomId })

      if (!res.success || !res.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: res.message })
        return
      }

      const { nextVideo, updatedQueue } = res.data

      io.to(roomId).emit(SERVER_EVENTS.QUEUE_UPDATED, { queue: updatedQueue })
      io.to(roomId).emit(SERVER_EVENTS.VIDEO_PLAY, {
        userId,
        currentTime: 0,
        videoUrl: nextVideo.videoUrl,
      })

      console.log(`[queue-controller] Next video in room ${roomId}: ${nextVideo.videoUrl}`)
    } catch (err: unknown) {
      console.error("[queue-controller] nextVideo:", err)
      const message = err instanceof Error ? err.message : "Failed to advance queue."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },
}
