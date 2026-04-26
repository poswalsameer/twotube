import { Socket, Server } from "socket.io"
import { SERVER_EVENTS } from "../constants/events"
import { roomService } from "../services/room.service"
import { cleanupService } from "../services/cleanup.service"

export const roomController = {
  async createRoom(payload: { userId: string }, socket: Socket, _io: Server) {
    try {
      const { userId } = payload
      if (!userId) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "userId is required." })
        return
      }

      const res = await roomService.createRoom({ userId, socketId: socket.id })

      if (!res.success || !res.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: res.message })
        return
      }

      const { room, roomKey } = res.data
      await socket.join(room.roomId)

      socket.emit(SERVER_EVENTS.ROOM_CREATED, {
        roomId: room.roomId,
        roomKey,
        hostId: room.hostId,
      })

      console.log(`[room-controller] Room ${room.roomId} created by ${userId}`)
    } catch (err) {
      console.error("[room-controller] createRoom:", err)
      socket.emit(SERVER_EVENTS.ERROR, { message: "Failed to create room." })
    }
  },

  async joinRoom(payload: { userId: string; roomKey: string }, socket: Socket, _io: Server) {
    try {
      const { userId, roomKey } = payload
      if (!userId || !roomKey) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "userId and roomKey are required." })
        return
      }

      const res = await roomService.joinRoom({ userId, roomKey, socketId: socket.id })

      if (!res.success || !res.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: res.message })
        return
      }

      const room = res.data
      await socket.join(room.roomId)

      // Notify existing host
      const hostSocketId = room.sockets[room.hostId]
      if (hostSocketId) {
        socket.to(hostSocketId).emit(SERVER_EVENTS.USER_JOINED, { userId, roomId: room.roomId })
      }

      // Send full sync state to new guest
      socket.emit(SERVER_EVENTS.ROOM_JOINED, {
        roomId: room.roomId,
        hostId: room.hostId,
        currentVideoUrl: room.currentVideoUrl,
        isPlaying: room.isPlaying,
        currentTime: room.currentTime,
      })

      console.log(`[room-controller] User ${userId} joined room ${room.roomId}`)
    } catch (err: unknown) {
      console.error("[room-controller] joinRoom:", err)
      const message = err instanceof Error ? err.message : "Failed to join room."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },

  async leaveRoom(payload: { userId: string; roomId: string }, socket: Socket, io: Server) {
    try {
      const { userId, roomId } = payload
      if (!userId || !roomId) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "userId and roomId are required." })
        return
      }

      const roomRes = roomService.getRoom(roomId)
      if (!roomRes.success || !roomRes.data) return

      const wasHostRes = roomService.isHost(roomId, userId)
      const wasHost = wasHostRes.data

      roomService.removeUser(roomId, userId)
      socket.leave(roomId)

      if (wasHost) {
        await cleanupService.cleanupRoom({ roomId, io })
        console.log(`[room-controller] Host ${userId} left — room ${roomId} deleted.`)
        return
      }

      const updatedRoomRes = roomService.getRoom(roomId)
      if (!updatedRoomRes.success || !updatedRoomRes.data || updatedRoomRes.data.users.length === 0) {
        await cleanupService.cleanupRoom({ roomId, io })
        console.log(`[room-controller] Room ${roomId} empty — deleted.`)
        return
      }

      io.to(roomId).emit(SERVER_EVENTS.USER_LEFT, { userId, roomId })
      console.log(`[room-controller] User ${userId} left room ${roomId}.`)
    } catch (err) {
      console.error("[room-controller] leaveRoom:", err)
      socket.emit(SERVER_EVENTS.ERROR, { message: "Failed to process leave." })
    }
  },

  async deleteRoom(payload: { userId: string; roomId: string }, socket: Socket, io: Server) {
    try {
      const { userId, roomId } = payload
      if (!userId || !roomId) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "userId and roomId are required." })
        return
      }

      const hostRes = roomService.isHost(roomId, userId)
      if (!hostRes.success || !hostRes.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "Only the host can delete the room." })
        return
      }

      await cleanupService.cleanupRoom({ roomId, io })
      console.log(`[room-controller] Room ${roomId} deleted by host ${userId}.`)
    } catch (err) {
      console.error("[room-controller] deleteRoom:", err)
      socket.emit(SERVER_EVENTS.ERROR, { message: "Failed to delete room." })
    }
  },

  kickUser(payload: { hostId: string; roomId: string }, socket: Socket, io: Server) {
    try {
      const { hostId, roomId } = payload
      if (!hostId || !roomId) {
        socket.emit(SERVER_EVENTS.ERROR, { message: "hostId and roomId are required." })
        return
      }

      const res = roomService.kickGuest(roomId, hostId)

      if (!res.success || !res.data) {
        socket.emit(SERVER_EVENTS.ERROR, { message: res.message })
        return
      }

      const { guestId, guestSocketId } = res.data

      if (guestSocketId) {
        const guestSocket = io.sockets.sockets.get(guestSocketId)
        guestSocket?.leave(roomId)
        io.to(guestSocketId).emit(SERVER_EVENTS.USER_KICKED, { roomId })
      }

      socket.to(roomId).emit(SERVER_EVENTS.USER_LEFT, { userId: guestId, roomId })
      console.log(`[room-controller] Host ${hostId} kicked ${guestId} from room ${roomId}.`)
    } catch (err: unknown) {
      console.error("[room-controller] kickUser:", err)
      const message = err instanceof Error ? err.message : "Failed to kick user."
      socket.emit(SERVER_EVENTS.ERROR, { message })
    }
  },
}
