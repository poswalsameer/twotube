import { Socket, Server } from "socket.io"
import { CLIENT_EVENTS } from "../constants/events"
import { chatController } from "../controllers/chat.controller"

export function registerChatRoutes({
  socket,
  io
}: {
  socket: Socket,
  io: Server
}) {
  socket.on(CLIENT_EVENTS.SEND_MESSAGE, (payload) =>
    chatController.sendMessage(payload, socket, io)
  )
}
