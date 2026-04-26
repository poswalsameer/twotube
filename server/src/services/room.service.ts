import { nanoid } from "nanoid"
import { roomRepo } from "../db/room.repo"
import { roomManager } from "../room-manager/room-manager"
import { generateRoomKey } from "../utils/generate-room-key"

export const roomService = {

  // CREATES A NEW ROOM, STORES IN DB AND MEMORY
  async createRoom({ userId, socketId }: { userId: string, socketId: string }) {
    try {
      const roomId = nanoid()
      const roomKey = generateRoomKey()

      const createRoomResponse = roomManager.createRoom({ roomId, hostId: userId, socketId })

      if (!createRoomResponse.success) {
        return {
          success: false,
          message: "Failed to create room",
          data: null
        }
      }

      await roomRepo.create({ roomId, roomKey, hostId: userId })

      return {
        success: true,
        message: "Room created successfully",
        data: { room: createRoomResponse.data, roomKey }
      }
    } catch (error: any) {
      console.error(`${userId}: Error while creating room: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || `Error while creating room`,
        data: null
      }
    }
  },

  // VALIDATES AND JOINS A USER TO A ROOM USING ROOMKEY
  async joinRoom({
    userId,
    roomKey,
    socketId
  }: {
    userId: string,
    roomKey: string,
    socketId: string
  }) {
    try {
      const dbRoom = await roomRepo.findByKey(roomKey)

      if (!dbRoom) {
        return {
          success: false,
          message: "Room not found. Check the key and try again",
          data: null
        }
      }

      const { roomId } = dbRoom
      const getRoomResponse = roomManager.getRoom(roomId)

      if (!getRoomResponse.success || !getRoomResponse.data) {
        return {
          success: false,
          message: "Room is no longer active",
          data: null
        }
      }

      if (getRoomResponse.data.users.includes(userId)) {
        return {
          success: false,
          message: "You are already in this room",
          data: null
        }
      }

      const isRoomFullResponse = roomManager.isFull(roomId)
      if (isRoomFullResponse.success) {
        return {
          success: false,
          message: "Room is full",
          data: null
        }
      }

      const addGuestResponse = roomManager.addGuest({ roomId, guestId: userId, socketId })

      if (!addGuestResponse.success) {
        return {
          success: false,
          message: addGuestResponse.message,
          data: null
        }
      }

      await roomRepo.updateGuest(roomId, userId)

      return {
        success: true,
        message: "Joined room successfully",
        data: addGuestResponse.data
      }
    } catch (error: any) {
      console.error(`${userId}: Error while joining room: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error while joining room",
        data: null
      }
    }
  },

  // REMOVES A USER FROM A ROOM IN MEMORY
  removeUser(roomId: string, userId: string) {
    try {
      const removeUserResponse = roomManager.removeUser({ roomId, userId })

      if (!removeUserResponse.success) {
        return {
          success: false,
          message: removeUserResponse.message,
          data: null
        }
      }

      return {
        success: true,
        message: "User removed successfully",
        data: removeUserResponse.data
      }
    } catch (error: any) {
      console.error(`${userId}: Error while removing user: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error while removing user",
        data: null
      }
    }
  },

  // KICKS A GUEST FROM THE ROOM (HOST-ONLY ACTION)
  kickGuest(roomId: string, hostId: string) {
    try {
      const isHostResponse = roomManager.isHost({ roomId, userId: hostId })
      if (!isHostResponse.success) {
        return {
          success: false,
          message: "Only the host can kick users",
          data: null
        }
      }

      const getRoomResponse = roomManager.getRoom(roomId)
      if (!getRoomResponse.success || !getRoomResponse.data || !getRoomResponse.data.guestId) {
        return {
          success: false,
          message: "No guest to kick",
          data: null
        }
      }

      const guestId = getRoomResponse.data.guestId
      const guestSocketId = getRoomResponse.data.sockets[guestId]

      const removeUserResponse = roomManager.removeUser({ roomId, userId: guestId })

      if (!removeUserResponse.success) {
        return {
          success: false,
          message: "Failed to kick guest",
          data: null
        }
      }

      return {
        success: true,
        message: "Guest kicked successfully",
        data: { guestId, guestSocketId }
      }
    } catch (error: any) {
      console.error(`${hostId}: Error while kicking guest: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error while kicking guest",
        data: null
      }
    }
  },

  // CHECKS IF THE USER IS HOST OR NOT
  isHost(roomId: string, userId: string) {
    try {
      const isHostResponse = roomManager.isHost({ roomId, userId })
      return {
        success: isHostResponse.success,
        message: isHostResponse.message,
        data: isHostResponse.success
      }
    } catch (error: any) {
      console.error(`${userId}: Error checking host status: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error checking host status",
        data: false
      }
    }
  },

  // GETS A ROOM BY ROOMID
  getRoom(roomId: string) {
    try {
      const getRoomResponse = roomManager.getRoom(roomId)
      return {
        success: getRoomResponse.success,
        message: getRoomResponse.message,
        data: getRoomResponse.data
      }
    } catch (error: any) {
      console.error(`Error getting room ${roomId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error getting room",
        data: null
      }
    }
  },

  // GETS A ROOM BY SOCKETID
  getRoomBySocketId(socketId: string) {
    try {
      const getRoomBySocketIdResponse = roomManager.getRoomBySocketId(socketId)
      return {
        success: getRoomBySocketIdResponse.success,
        message: getRoomBySocketIdResponse.message,
        data: getRoomBySocketIdResponse.data
      }
    } catch (error: any) {
      console.error(`Error getting room by socket ${socketId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error getting room by socket",
        data: null
      }
    }
  },

  // GETS A USERID BY SOCKETID
  getUserIdBySocketId(socketId: string) {
    try {
      const getRoomBySocketIdResponse = roomManager.getRoomBySocketId(socketId)
      if (!getRoomBySocketIdResponse.success || !getRoomBySocketIdResponse.data) {
        return {
          success: false,
          message: "User not found for this socket",
          data: null
        }
      }
      const userId = Object.entries(getRoomBySocketIdResponse.data.sockets).find(([, sid]) => sid === socketId)?.[0] ?? null
      return {
        success: !!userId,
        message: userId ? "User found" : "User not found",
        data: userId
      }
    } catch (error: any) {
      console.error(`Error getting user by socket ${socketId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error getting user by socket",
        data: null
      }
    }
  },
}
