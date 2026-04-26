import { Socket, Server } from "socket.io"
import { videoSyncService } from "../services/video-sync.service"
import { SERVER_EVENTS } from "../constants/events"

export const videoSyncController = {
  play(
    payload: { userId: string; roomId: string; currentTime: number; videoUrl?: string },
    socket: Socket,
    io: Server
  ) {
    try {
      const { userId, roomId, currentTime, videoUrl } = payload
      const res = videoSyncService.play({ userId, roomId, currentTime, videoUrl })

      if (!res.success || !res.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: res.message })
        return
      }

      io.to(roomId).emit(SERVER_EVENTS.VIDEO_PLAY, res.data)
      console.log(`[video-sync-controller] PLAY room ${roomId} at ${currentTime}s`)
    } catch (err: unknown) {
      console.error("[video-sync-controller] play:", err)
      const message = err instanceof Error ? err.message : "Failed to process play."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },

  pause(
    payload: { userId: string; roomId: string; currentTime: number },
    socket: Socket,
    io: Server
  ) {
    try {
      const { userId, roomId, currentTime } = payload
      const res = videoSyncService.pause({ userId, roomId, currentTime })

      if (!res.success || !res.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: res.message })
        return
      }

      io.to(roomId).emit(SERVER_EVENTS.VIDEO_PAUSE, res.data)
      console.log(`[video-sync-controller] PAUSE room ${roomId} at ${currentTime}s`)
    } catch (err: unknown) {
      console.error("[video-sync-controller] pause:", err)
      const message = err instanceof Error ? err.message : "Failed to process pause."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },

  seek(
    payload: { userId: string; roomId: string; currentTime: number },
    socket: Socket,
    io: Server
  ) {
    try {
      const { userId, roomId, currentTime } = payload
      const res = videoSyncService.seek({ userId, roomId, currentTime })

      if (!res.success || !res.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: res.message })
        return
      }

      // Relay to peers only — sender already applied the seek locally
      socket.to(roomId).emit(SERVER_EVENTS.VIDEO_SEEK, res.data)
      console.log(`[video-sync-controller] SEEK room ${roomId} to ${currentTime}s`)
    } catch (err: unknown) {
      console.error("[video-sync-controller] seek:", err)
      const message = err instanceof Error ? err.message : "Failed to process seek."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },
}
