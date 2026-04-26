import { Socket, Server } from "socket.io"
import { CLIENT_EVENTS } from "../constants/events"
import { queueController } from "../controllers/queue.controller"

export function registerQueueRoutes({
  socket,
  io
}: {
  socket: Socket,
  io: Server
}) {
  socket.on(CLIENT_EVENTS.ADD_TO_QUEUE, (payload) =>
    queueController.addToQueue(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.NEXT_VIDEO, (payload) =>
    queueController.nextVideo(payload, socket, io)
  )
}
