import { roomManager } from "../room-manager/room-manager"
import { queueRepo } from "../db/queue.repo"

export const queueService = {
  /**
   * Adds a video to the queue and returns the full updated queue.
   */
  async addToQueue(userId: string, roomId: string, videoUrl: string) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.users.includes(userId)) {
      throw new Error("You are not in this room.")
    }

    await queueRepo.add({ roomId, videoUrl, addedBy: userId })
    return queueRepo.getByRoom(roomId)
  },

  /**
   * Advances the queue: removes the first item, returns the next video info
   * and the updated queue for broadcasting.
   */
  async nextVideo(userId: string, roomId: string) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.users.includes(userId)) {
      throw new Error("You are not in this room.")
    }

    const currentQueue = await queueRepo.getByRoom(roomId)
    if (!currentQueue || currentQueue.length === 0) {
      throw new Error("Queue is empty.")
    }

    const nextVideo = currentQueue[0]
    await queueRepo.removeFirst(roomId)

    // Mirror play state in memory
    roomManager.setVideo(roomId, nextVideo.videoUrl)
    roomManager.setPlaying(roomId, true, 0)

    const updatedQueue = await queueRepo.getByRoom(roomId)
    return { nextVideo, updatedQueue }
  },
}
