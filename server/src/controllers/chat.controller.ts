import { Socket, Server } from "socket.io"
import { chatService } from "../services/chat.service"
import { SERVER_EVENTS } from "../constants/events"

export const chatController = {
  async sendMessage(
    payload: { userId: string; roomId: string; text: string },
    socket: Socket,
    io: Server
  ) {
    try {
      const { userId, roomId, text } = payload

      if (!userId || !roomId || !text?.trim()) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "userId, roomId, and text are required." })
        return
      }

      const res = await chatService.sendMessage({ userId, roomId, text })

      if (!res.success || !res.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: res.message })
        return
      }

      io.to(roomId).emit(SERVER_EVENTS.MESSAGE_RECEIVED, res.data)

      console.log(`[chat-controller] Message from ${userId} in room ${roomId}`)
    } catch (err: unknown) {
      console.error("[chat-controller] sendMessage:", err)
      const message = err instanceof Error ? err.message : "Failed to send message."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },
}
