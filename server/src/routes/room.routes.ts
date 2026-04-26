import { Socket, Server } from "socket.io"
import { CLIENT_EVENTS } from "../constants/events"
import { roomController } from "../controllers/room.controller"

export function registerRoomRoutes({
  socket,
  io
}: {
  socket: Socket,
  io: Server
}) {
  socket.on(CLIENT_EVENTS.CREATE_ROOM, (payload) =>
    roomController.createRoom(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.JOIN_ROOM, (payload) =>
    roomController.joinRoom(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.LEAVE_ROOM, (payload) =>
    roomController.leaveRoom(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.DELETE_ROOM, (payload) =>
    roomController.deleteRoom(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.KICK_USER, (payload) =>
    roomController.kickUser(payload, socket, io)
  )
}
