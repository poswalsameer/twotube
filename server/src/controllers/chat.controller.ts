import { Socket, Server } from "socket.io"
import { chatService } from "../services/chat.service"
import { SERVER_EVENTS } from "../socket/events"

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

      const message = await chatService.sendMessage(userId, roomId, text)
      io.to(roomId).emit(SERVER_EVENTS.MESSAGE_RECEIVED, message)

      console.log(`[chat-controller] Message from ${userId} in room ${roomId}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send message."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },
}
