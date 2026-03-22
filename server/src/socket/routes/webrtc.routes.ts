import { Socket, Server } from "socket.io"
import { CLIENT_EVENTS } from "../events"
import { webrtcController } from "../../controllers/webrtc.controller"

/**
 * Registers WebRTC signalling socket events for a connected socket.
 */
export function registerWebrtcRoutes(socket: Socket, io: Server) {
  socket.on(CLIENT_EVENTS.WEBRTC_OFFER, (payload) =>
    webrtcController.offer(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.WEBRTC_ANSWER, (payload) =>
    webrtcController.answer(payload, socket, io)
  )

  socket.on(CLIENT_EVENTS.WEBRTC_ICE, (payload) =>
    webrtcController.ice(payload, socket, io)
  )
}
