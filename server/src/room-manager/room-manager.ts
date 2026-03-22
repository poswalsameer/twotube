/**
 * In-memory room manager — single source of truth for active rooms.
 * Convex is the persistence layer; this is ephemeral runtime state.
 */

export interface RoomState {
  roomId: string
  hostId: string
  guestId: string | null
  users: string[]                 // ordered: [hostId, guestId?]
  sockets: Record<string, string> // { userId -> socketId }
  currentVideoUrl: string | null
  isPlaying: boolean
  currentTime: number
}

class RoomManager {
  private rooms: Map<string, RoomState> = new Map();

  // ── Create / Delete ─────────────────────────────────────────────────────────

  createRoom(roomId: string, hostId: string, socketId: string): RoomState {
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
    return room
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId)
  }

  // ── Lookups ─────────────────────────────────────────────────────────────────

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId)
  }

  getRoomByUserId(userId: string): RoomState | undefined {
    for (const room of this.rooms.values()) {
      if (room.users.includes(userId)) return room
    }
    return undefined
  }

  getRoomBySocketId(socketId: string): RoomState | undefined {
    for (const room of this.rooms.values()) {
      if (Object.values(room.sockets).includes(socketId)) return room
    }
    return undefined
  }

  // ── User management ─────────────────────────────────────────────────────────

  addGuest(roomId: string, guestId: string, socketId: string): RoomState | null {
    const room = this.rooms.get(roomId)
    if (!room) return null
    room.guestId = guestId
    room.users.push(guestId)
    room.sockets[guestId] = socketId
    return room
  }

  removeUser(roomId: string, userId: string): RoomState | null {
    const room = this.rooms.get(roomId)
    if (!room) return null
    room.users = room.users.filter((u) => u !== userId)
    delete room.sockets[userId]
    if (room.guestId === userId) room.guestId = null
    return room
  }

  // ── Video state ─────────────────────────────────────────────────────────────

  setVideo(roomId: string, url: string): void {
    const room = this.rooms.get(roomId)
    if (room) room.currentVideoUrl = url
  }

  setPlaying(roomId: string, isPlaying: boolean, currentTime: number): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    room.isPlaying = isPlaying
    room.currentTime = currentTime
  }

  setCurrentTime(roomId: string, currentTime: number): void {
    const room = this.rooms.get(roomId)
    if (room) room.currentTime = currentTime
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  isFull(roomId: string): boolean {
    const room = this.rooms.get(roomId)
    return room ? room.users.length >= 2 : false
  }

  isHost(roomId: string, userId: string): boolean {
    return this.rooms.get(roomId)?.hostId === userId
  }

  getPeerSocketId(roomId: string, myUserId: string): string | undefined {
    const room = this.rooms.get(roomId)
    if (!room) return undefined
    const peerId = room.users.find((u) => u !== myUserId)
    return peerId ? room.sockets[peerId] : undefined
  }
}

// Singleton
export const roomManager = new RoomManager()
