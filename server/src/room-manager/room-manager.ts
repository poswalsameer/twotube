import type {
  RoomState,
  AddGuestRequest,
  AddGuestResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  DeleteRoomRequest,
  DeleteRoomResponse,
  GetRoomBySocketIdRequest,
  GetRoomBySocketIdResponse,
  GetRoomByUserIdRequest,
  GetRoomByUserIdResponse,
  GetRoomRequest,
  GetRoomResponse,
  RemoveUserRequest,
  RemoveUserResponse,
  SetCurrentTimeRequest,
  SetCurrentTimeResponse,
  SetPlayingRequest,
  SetPlayingResponse,
  SetVideoRequest,
  SetVideoResponse
} from "../types"

class RoomManager {
  private rooms: Map<string, RoomState> = new Map();

  // CREATE ROOM 
  createRoom({
    roomId,
    hostId,
    socketId
  }: CreateRoomRequest): CreateRoomResponse {
    const room: RoomState = {
      roomId,
      hostId,
      guestId: null,
      users: [hostId],
      sockets: { [hostId]: socketId },
      currentVideoUrl: null,
      isPlaying: false,
      currentTime: 0,
    }

    this.rooms.set(roomId, room)

    return {
      success: true,
      message: "Room created successfully",
      data: room
    }
  }

  // DELETE ROOM
  deleteRoom(roomId: DeleteRoomRequest): DeleteRoomResponse {
    this.rooms.delete(roomId)

    return {
      success: true,
      message: "Room deleted successfully",
      data: null
    }
  }

  // GET ROOM
  getRoom(roomId: GetRoomRequest): GetRoomResponse {
    const currentRoom = this.rooms.get(roomId)

    if (!currentRoom) {
      return {
        success: false,
        message: "Room not found",
        data: null
      }
    }

    return {
      success: true,
      message: "Room found successfully",
      data: currentRoom
    }
  }

  // GET ROOM BY USER ID
  getRoomByUserId(userId: GetRoomByUserIdRequest): GetRoomByUserIdResponse {
    for (const room of this.rooms.values()) {
      if (room.users.includes(userId)) {
        return {
          success: true,
          message: "Room found successfully",
          data: room
        }
      }
    }
    return {
      success: false,
      message: "Room not found",
      data: null
    }
  }

  // GET ROOM BY SOCKET ID
  getRoomBySocketId(socketId: GetRoomBySocketIdRequest): GetRoomBySocketIdResponse {
    for (const room of this.rooms.values()) {
      if (Object.values(room.sockets).includes(socketId)) {
        return {
          success: true,
          message: `Room found with ${socketId}`,
          data: room
        }
      }
    }
    return {
      success: false,
      message: "Room not found",
      data: null
    }
  }

  // ADD GUEST
  addGuest({
    roomId,
    guestId,
    socketId
  }: AddGuestRequest): AddGuestResponse {
    const room = this.rooms.get(roomId)

    if (!room) return {
      success: false,
      message: "Room not found",
      data: null
    }

    room.guestId = guestId
    room.users.push(guestId)
    room.sockets[guestId] = socketId

    return {
      success: true,
      message: "Guest added successfully",
      data: room
    }
  }

  // REMOVE USER
  removeUser({
    roomId,
    userId
  }: RemoveUserRequest): RemoveUserResponse {
    const room = this.rooms.get(roomId)

    if (!room) return {
      success: false,
      message: "Room not found",
      data: null
    }

    room.users = room.users.filter((u) => u !== userId)
    delete room.sockets[userId]
    if (room.guestId === userId) room.guestId = null

    return {
      success: true,
      message: "User removed successfully",
      data: room
    }
  }

  // SET VIDEO
  setVideo({
    roomId,
    url
  }: SetVideoRequest): SetVideoResponse {
    const room = this.rooms.get(roomId)

    if (!room) return {
      success: false,
      message: "Room not found",
      data: null
    }

    room.currentVideoUrl = url

    return {
      success: true,
      message: "Video set successfully",
      data: room
    }
  }

  // SET PLAYING
  setPlaying({
    roomId,
    isPlaying,
    currentTime
  }: SetPlayingRequest): SetPlayingResponse {
    const room = this.rooms.get(roomId)

    if (!room) return {
      success: false,
      message: "Room not found",
      data: null
    }

    room.isPlaying = isPlaying
    room.currentTime = currentTime

    return {
      success: true,
      message: "Playing state updated successfully",
      data: room
    }
  }

  // SET CURRENT TIME
  setCurrentTime({
    roomId,
    currentTime
  }: SetCurrentTimeRequest): SetCurrentTimeResponse {
    const room = this.rooms.get(roomId)

    if (!room) {
      return {
        success: false,
        message: "Room not found",
      }
    }

    room.currentTime = currentTime

    return {
      success: true,
      message: "Current time updated successfully",
    }
  }

  // TO CHECK IF ROOM IS FULL  OR NOT
  isFull(roomId: string) {
    const room = this.rooms.get(roomId)

    if (!room) {
      return {
        success: false,
        message: "Room not found",
      }
    }

    const isFull = room?.users.length >= 2

    return {
      success: isFull,
      message: isFull ? "Room is full" : "Room is not full",
    }

  }

  //  TO CHECK IF THE CURRENT USER IS HOST OR NOT
  isHost({
    roomId,
    userId
  }: {
    roomId: string,
    userId: string
  }) {
    const room = this.rooms.get(roomId)

    if (!room) {
      return {
        success: false,
        message: "Room not found",
      }
    }

    const isHost = room?.hostId === userId

    return {
      success: isHost,
      message: isHost ? "User is host" : "User is not host",
    }
  }

  // TO GET PEER SOCKET ID
  getPeerSocketId({
    roomId,
    myUserId
  }: {
    roomId: string,
    myUserId: string
  }) {
    const room = this.rooms.get(roomId)

    if (!room) {
      return {
        success: false,
        message: "Room not found",
      }
    }

    const peerId = room.users.find((u) => u !== myUserId)
    const peerSocketId = peerId ? room.sockets[peerId] : undefined

    return {
      success: true,
      message: "Peer socket ID found successfully",
      data: peerSocketId
    }
  }
}

export const roomManager = new RoomManager()
