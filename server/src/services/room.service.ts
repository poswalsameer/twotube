import { nanoid } from "nanoid"
import { roomManager } from "../room-manager/room-manager"
import { roomRepo } from "../db/room.repo"
import { generateRoomKey } from "../utils/generate-room-key"

export const roomService = {
  /**
   * Creates a new room, registers it in memory and persists to Convex.
   * Returns the new room state plus the human-readable key.
   */
  async createRoom(userId: string, socketId: string) {
    const roomId = nanoid()
    const roomKey = generateRoomKey()

    const room = roomManager.createRoom(roomId, userId, socketId)
    await roomRepo.create({ roomId, roomKey, hostId: userId })

    return { room, roomKey }
  },

  /**
   * Validates and joins a user to a room by roomKey.
   * Returns the updated room state.
   */
  async joinRoom(userId: string, roomKey: string, socketId: string) {
    const dbRoom = await roomRepo.findByKey(roomKey)
    if (!dbRoom) throw new Error("Room not found. Check the key and try again.")

    const { roomId } = dbRoom
    const memRoom = roomManager.getRoom(roomId)
    if (!memRoom) throw new Error("Room is no longer active.")
    if (memRoom.users.includes(userId)) throw new Error("You are already in this room.")
    if (roomManager.isFull(roomId)) throw new Error("Room is full.")

    const updatedRoom = roomManager.addGuest(roomId, userId, socketId)!
    await roomRepo.updateGuest(roomId, userId)

    return updatedRoom
  },

  /**
   * Removes a user from a room in memory. Does NOT trigger cleanup —
   * the controller decides whether to clean up based on who left.
   */
  removeUser(roomId: string, userId: string) {
    return roomManager.removeUser(roomId, userId)
  },

  /**
   * Removes the guest from the room (host-only action).
   * Returns the kicked guest's id + socket id for targeted notifications.
   */
  kickGuest(roomId: string, hostId: string) {
    if (!roomManager.isHost(roomId, hostId)) {
      throw new Error("Only the host can kick users.")
    }

    const room = roomManager.getRoom(roomId)
    if (!room || !room.guestId) throw new Error("No guest to kick.")

    const guestId = room.guestId
    const guestSocketId = room.sockets[guestId]

    roomManager.removeUser(roomId, guestId)

    return { guestId, guestSocketId }
  },

  isHost(roomId: string, userId: string) {
    return roomManager.isHost(roomId, userId)
  },

  getRoom(roomId: string) {
    return roomManager.getRoom(roomId)
  },

  getRoomBySocketId(socketId: string) {
    return roomManager.getRoomBySocketId(socketId)
  },

  getUserIdBySocketId(socketId: string) {
    const room = roomManager.getRoomBySocketId(socketId)
    if (!room) return null
    return Object.entries(room.sockets).find(([, sid]) => sid === socketId)?.[0] ?? null
  },
}
