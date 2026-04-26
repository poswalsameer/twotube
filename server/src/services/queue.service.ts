import { queueRepo } from "../db/queue.repo"
import { roomManager } from "../room-manager/room-manager"

export const queueService = {

  // ADDS A VIDEO TO THE QUEUE AND RETURNS THE FULL UPDATED QUEUE
  async addToQueue({
    userId,
    roomId,
    videoUrl
  }: {
    userId: string,
    roomId: string,
    videoUrl: string
  }) {
    try {
      const getRoomResponse = roomManager.getRoom(roomId)

      if (!getRoomResponse.success || !getRoomResponse.data) {
        return {
          success: false,
          message: "Room not found or no longer active",
          data: null
        }
      }

      if (!getRoomResponse.data.users.includes(userId)) {
        return {
          success: false,
          message: "You are not in this room",
          data: null
        }
      }

      if (!videoUrl) {
        return {
          success: false,
          message: "Video URL is required",
          data: null
        }
      }

      await queueRepo.add({ roomId, videoUrl, addedBy: userId })
      const updatedQueue = await queueRepo.getByRoom(roomId)

      return {
        success: true,
        message: "Video added to queue successfully",
        data: updatedQueue
      }
    } catch (error: any) {
      console.error(`${userId}: Error while adding to queue in room ${roomId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error while adding to queue",
        data: null
      }
    }
  },

  // ADVANCES THE QUEUE: REMOVES THE FIRST ITEM, RETURNS NEXT VIDEO AND UPDATED QUEUE
  async nextVideo({
    userId,
    roomId
  }: {
    userId: string,
    roomId: string
  }) {
    try {
      const getRoomResponse = roomManager.getRoom(roomId)

      if (!getRoomResponse.success || !getRoomResponse.data) {
        return {
          success: false,
          message: "Room not found or no longer active",
          data: null
        }
      }

      if (!getRoomResponse.data.users.includes(userId)) {
        return {
          success: false,
          message: "You are not in this room",
          data: null
        }
      }

      const currentQueue = await queueRepo.getByRoom(roomId)
      if (!currentQueue || currentQueue.length === 0) {
        return {
          success: false,
          message: "Queue is empty",
          data: null
        }
      }

      const nextVideo = currentQueue[0]
      await queueRepo.removeFirst(roomId)

      // Mirror play state in memory
      roomManager.setVideo({ roomId, url: nextVideo.videoUrl })
      roomManager.setPlaying({ roomId, isPlaying: true, currentTime: 0 })

      const updatedQueue = await queueRepo.getByRoom(roomId)

      return {
        success: true,
        message: "Advanced to next video",
        data: { nextVideo, updatedQueue }
      }
    } catch (error: any) {
      console.error(`${userId}: Error while advancing queue in room ${roomId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error while advancing queue",
        data: null
      }
    }
  },
}
