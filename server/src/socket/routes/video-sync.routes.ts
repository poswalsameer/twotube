import { Socket, Server } from "socket.io"
import { CLIENT_EVENTS } from "../events"
import { videoSyncController } from "../../controllers/video-sync.controller"

/**
 * Registers video synchronisation socket events for a connected socket.
 */
export function registerVideoSyncRoutes(socket: Socket, io: Server) {
  socket.on(CLIENT_EVENTS.PLAY_VIDEO, (payload) =>
    videoSyncController.play(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.PAUSE_VIDEO, (payload) =>
    videoSyncController.pause(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.SEEK_VIDEO, (payload) =>
    videoSyncController.seek(payload, socket, io)
  )
}
