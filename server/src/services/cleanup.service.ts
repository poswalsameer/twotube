import { Server } from "socket.io"
import { roomRepo } from "../db/room.repo"
import { queueRepo } from "../db/queue.repo"
import { messageRepo } from "../db/message.repo"
import { SERVER_EVENTS } from "../constants/events"
import { roomManager } from "../room-manager/room-manager"

export const cleanupService = {

  // FULLY TEARS DOWN A ROOM: DB DELETIONS, SOCKET BROADCASTS, AND MEMORY WIPE
  async cleanupRoom({
    roomId,
    io
  }: {
    roomId: string,
    io: Server
  }) {
    try {
      const getRoomResponse = roomManager.getRoom(roomId)

      if (!getRoomResponse.success || !getRoomResponse.data) {
        return {
          success: false,
          message: "Room not found or already cleaned up",
          data: null
        }
      }

      const room = getRoomResponse.data

      // Parallel DB deletions — use allSettled so one failure doesn't block others
      await Promise.allSettled([
        messageRepo.deleteByRoom(roomId),
        queueRepo.deleteByRoom(roomId),
        roomRepo.deleteRoom(roomId),
      ])

      // Notify connected clients before wiping from memory
      for (const socketId of Object.values(room.sockets)) {
        io.to(socketId).emit(SERVER_EVENTS.ROOM_DELETED, { roomId })
      }

      const deleteRoomResponse = roomManager.deleteRoom(roomId)

      if (!deleteRoomResponse.success) {
        return {
          success: false,
          message: "Failed to delete room from memory",
          data: null
        }
      }

      console.log(`[cleanup-service] Room ${roomId} fully cleaned up.`)

      return {
        success: true,
        message: "Room cleaned up successfully",
        data: null
      }
    } catch (error: any) {
      console.error(`Error while cleaning up room ${roomId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error while cleaning up room",
        data: null
      }
    }
  }
}
