import { Socket, Server } from "socket.io"
import { videoSyncService } from "../services/video-sync.service"
import { SERVER_EVENTS } from "../socket/events"

export const videoSyncController = {
  play(
    payload: { userId: string; roomId: string; currentTime: number; videoUrl?: string },
    socket: Socket,
    io: Server
  ) {
    try {
      const { userId, roomId, currentTime, videoUrl } = payload
      const data = videoSyncService.play(userId, roomId, currentTime, videoUrl)
      io.to(roomId).emit(SERVER_EVENTS.VIDEO_PLAY, data)
      console.log(`[video-sync-controller] PLAY room ${roomId} at ${currentTime}s`)
    } catch (err: unknown) {
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
      const data = videoSyncService.pause(userId, roomId, currentTime)
      io.to(roomId).emit(SERVER_EVENTS.VIDEO_PAUSE, data)
      console.log(`[video-sync-controller] PAUSE room ${roomId} at ${currentTime}s`)
    } catch (err: unknown) {
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
      const data = videoSyncService.seek(userId, roomId, currentTime)
      // Relay to peers only — sender already applied the seek locally
      socket.to(roomId).emit(SERVER_EVENTS.VIDEO_SEEK, data)
      console.log(`[video-sync-controller] SEEK room ${roomId} to ${currentTime}s`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process seek."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },
}
