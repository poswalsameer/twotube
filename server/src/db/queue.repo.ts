import { api } from "../../convex/_generated/api"
import { convex } from "./convex-client"

export interface AddToQueueArgs {
  roomId: string
  videoUrl: string
  addedBy: string
}

export const queueRepo = {
  async add(args: AddToQueueArgs) {
    return convex.mutation(api.queue.addToQueue, args)
  },

  async getByRoom(roomId: string) {
    return convex.query(api.queue.getQueue, { roomId })
  },

  async removeFirst(roomId: string) {
    return convex.mutation(api.queue.removeFirst, { roomId })
  },

  async deleteByRoom(roomId: string): Promise<void> {
    await convex.mutation(api.queue.deleteQueueByRoom, { roomId })
  },
}
