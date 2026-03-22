import { Socket, Server } from "socket.io"
import { CLIENT_EVENTS } from "../events"
import { chatController } from "../../controllers/chat.controller"

/**
 * Registers the chat socket event for a connected socket.
 */
export function registerChatRoutes(socket: Socket, io: Server) {
  socket.on(CLIENT_EVENTS.SEND_MESSAGE, (payload) =>
    chatController.sendMessage(payload, socket, io)
  )
}
