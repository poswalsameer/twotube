import { Server } from "socket.io"
import { roomManager } from "../room-manager/room-manager"
import { roomRepo } from "../db/room.repo"
import { messageRepo } from "../db/message.repo"
import { queueRepo } from "../db/queue.repo"
import { SERVER_EVENTS } from "../socket/events"

/**
 * Fully tears down a room:
 *  1. Deletes messages, queue, and room document from Convex (parallel)
 *  2. Broadcasts ROOM_DELETED to all connected sockets
 *  3. Removes the room from the in-memory store
 */
export async function cleanupRoom(roomId: string, io: Server): Promise<void> {
  const room = roomManager.getRoom(roomId)
  if (!room) return

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

  roomManager.deleteRoom(roomId)
  console.log(`[cleanup-service] Room ${roomId} fully cleaned up.`)
}
