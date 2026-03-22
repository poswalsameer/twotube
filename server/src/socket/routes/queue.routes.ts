import { Socket, Server } from "socket.io"
import { CLIENT_EVENTS } from "../events"
import { queueController } from "../../controllers/queue.controller"

/**
 * Registers queue socket events for a connected socket.
 */
export function registerQueueRoutes(socket: Socket, io: Server) {
  socket.on(CLIENT_EVENTS.ADD_TO_QUEUE, (payload) =>
    queueController.addToQueue(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.NEXT_VIDEO, (payload) =>
    queueController.nextVideo(payload, socket, io)
  )
}
