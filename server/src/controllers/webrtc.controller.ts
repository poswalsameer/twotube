import { Socket, Server } from "socket.io"
import { roomManager } from "../room-manager/room-manager"
import { SERVER_EVENTS } from "../constants/events"

interface WebRTCPayload {
  userId: string
  roomId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdp?: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidate?: Record<string, any>
}

/**
 * Looks up the peer and forwards the payload to their socket.
 * The server never inspects WebRTC payload content — it's a pure relay.
 */
function forwardToPeer(eventName: string, payload: WebRTCPayload, socket: Socket, io: Server) {
  const res = roomManager.getPeerSocketId({ roomId: payload.roomId, myUserId: payload.userId })
  
  if (!res.success || !res.data) {
    socket.emit(SERVER_EVENTS.ERROR, { message: "Peer is not connected." })
    return
  }
  
  io.to(res.data).emit(eventName, payload)
}

export const webrtcController = {
  offer(payload: WebRTCPayload, socket: Socket, io: Server) {
    forwardToPeer(SERVER_EVENTS.WEBRTC_OFFER, payload, socket, io)
    console.log(`[webrtc-controller] Offer forwarded in room ${payload.roomId}`)
  },

  answer(payload: WebRTCPayload, socket: Socket, io: Server) {
    forwardToPeer(SERVER_EVENTS.WEBRTC_ANSWER, payload, socket, io)
    console.log(`[webrtc-controller] Answer forwarded in room ${payload.roomId}`)
  },

  ice(payload: WebRTCPayload, socket: Socket, io: Server) {
    forwardToPeer(SERVER_EVENTS.WEBRTC_ICE, payload, socket, io)
  },
}
