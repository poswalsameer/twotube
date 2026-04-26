import { Server, Socket } from "socket.io"
import { Server as HttpServer } from "http"
import { SERVER_EVENTS } from "../constants/events"
import { roomService } from "../services/room.service"
import { cleanupService } from "../services/cleanup.service"
import { registerRoomRoutes } from "../routes/room.routes"
import { registerChatRoutes } from "../routes/chat.routes"
import { registerQueueRoutes } from "../routes/queue.routes"
import { registerWebrtcRoutes } from "../routes/webrtc.routes"
import { registerVideoSyncRoutes } from "../routes/video-sync.routes"

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
      credentials: true,
    },
    pingTimeout: 10_000,
    pingInterval: 5_000,
  })

  io.on("connection", (socket: Socket) => {
    console.log(`[socket-server] Connected: ${socket.id}`)

    // REGISTERING ALL ROUTES
    registerRoomRoutes({ socket, io })
    registerChatRoutes({ socket, io })
    registerVideoSyncRoutes({ socket, io })
    registerQueueRoutes({ socket, io })
    registerWebrtcRoutes({ socket, io })

    // HANDLING DISCONNNECTION
    socket.on("disconnect", async (reason) => {
      console.log(`[socket-server] Disconnected: ${socket.id} (${reason})`)

      const roomRes = roomService.getRoomBySocketId(socket.id)
      if (!roomRes.success || !roomRes.data) return

      const room = roomRes.data
      const { roomId } = room
      const userRes = roomService.getUserIdBySocketId(socket.id)
      if (!userRes.success || !userRes.data) return
      const userId = userRes.data

      const hostRes = roomService.isHost(roomId, userId)
      const wasHost = hostRes.data
      roomService.removeUser(roomId, userId)

      if (wasHost) {
        await cleanupService.cleanupRoom({ roomId, io })
        console.log(`[socket-server] Host ${userId} disconnected — room ${roomId} deleted.`)
        return
      }

      const updatedRoomRes = roomService.getRoom(roomId)
      if (!updatedRoomRes.success || !updatedRoomRes.data || updatedRoomRes.data.users.length === 0) {
        await cleanupService.cleanupRoom({ roomId, io })
        console.log(`[socket-server] Room ${roomId} empty after disconnect — deleted.`)
      } else {
        io.to(roomId).emit(SERVER_EVENTS.USER_LEFT, { userId, roomId })
        console.log(`[socket-server] User ${userId} disconnected from room ${roomId}.`)
      }
    })
  })

  return io
}
