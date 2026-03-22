import { api } from "../../convex/_generated/api"
import { convex } from "./convex-client"

export interface CreateRoomArgs {
  roomId: string
  roomKey: string
  hostId: string
}

export const roomRepo = {
  async create(args: CreateRoomArgs): Promise<void> {
    await convex.mutation(api.rooms.createRoom, args)
  },

  async findByKey(roomKey: string) {
    return convex.query(api.rooms.getRoomByKey, { roomKey })
  },

  async findById(roomId: string) {
    return convex.query(api.rooms.getRoomById, { roomId })
  },

  async updateGuest(roomId: string, guestId: string): Promise<void> {
    await convex.mutation(api.rooms.updateGuest, { roomId, guestId })
  },

  async updateVideoState(
    roomId: string,
    currentVideoUrl: string | null,
    isPlaying: boolean,
    currentTime: number
  ): Promise<void> {
    await convex.mutation(api.rooms.updateVideoState, {
      roomId,
      currentVideoUrl,
      isPlaying,
      currentTime,
    })
  },

  async deleteRoom(roomId: string): Promise<void> {
    await convex.mutation(api.rooms.deleteRoom, { roomId })
  },
}
