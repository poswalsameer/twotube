import { Server as HttpServer } from "http"
import { Server, Socket } from "socket.io"
import { roomService } from "../services/room.service"
import { cleanupRoom } from "../services/cleanup.service"
import { SERVER_EVENTS } from "./events"
import { registerRoomRoutes } from "./routes/room.routes"
import { registerChatRoutes } from "./routes/chat.routes"
import { registerVideoSyncRoutes } from "./routes/video-sync.routes"
import { registerQueueRoutes } from "./routes/queue.routes"
import { registerWebrtcRoutes } from "./routes/webrtc.routes"

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

    // ── Register all route groups ───────────────────────────────────────────
    registerRoomRoutes(socket, io)
    registerChatRoutes(socket, io)
    registerVideoSyncRoutes(socket, io)
    registerQueueRoutes(socket, io)
    registerWebrtcRoutes(socket, io)

    // ── Disconnect handling ─────────────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
      console.log(`[socket-server] Disconnected: ${socket.id} (${reason})`)

      const room = roomService.getRoomBySocketId(socket.id)
      if (!room) return

      const { roomId } = room
      const userId = roomService.getUserIdBySocketId(socket.id)
      if (!userId) return

      const wasHost = roomService.isHost(roomId, userId)
      roomService.removeUser(roomId, userId)

      if (wasHost) {
        await cleanupRoom(roomId, io)
        console.log(`[socket-server] Host ${userId} disconnected — room ${roomId} deleted.`)
        return
      }

      const updatedRoom = roomService.getRoom(roomId)
      if (!updatedRoom || updatedRoom.users.length === 0) {
        await cleanupRoom(roomId, io)
        console.log(`[socket-server] Room ${roomId} empty after disconnect — deleted.`)
      } else {
        io.to(roomId).emit(SERVER_EVENTS.USER_LEFT, { userId, roomId })
        console.log(`[socket-server] User ${userId} disconnected from room ${roomId}.`)
      }
    })
  })

  return io
}
