import { roomRepo } from "../db/room.repo"
import { roomManager } from "../room-manager/room-manager"

export const videoSyncService = {

  // SETS THE ROOM PLAYING STATE AND FIRES AN ASYNC DB UPDATE
  play({
    userId,
    roomId,
    currentTime,
    videoUrl
  }: {
    userId: string,
    roomId: string,
    currentTime: number,
    videoUrl?: string
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

      const room = getRoomResponse.data

      if (!room.users.includes(userId)) {
        return {
          success: false,
          message: "You are not in this room",
          data: null
        }
      }

      if (videoUrl) {
        roomManager.setVideo({ roomId, url: videoUrl })
      }

      roomManager.setPlaying({ roomId, isPlaying: true, currentTime })

      // Persist asynchronously — video sync latency must be minimal
      roomRepo
        .updateVideoState(roomId, videoUrl ?? room.currentVideoUrl, true, currentTime)
        .catch((e) => console.error(`[video-sync-service] DB play update failed for room ${roomId}:`, e))

      return {
        success: true,
        message: "Video playback started",
        data: { userId, currentTime, videoUrl: videoUrl ?? room.currentVideoUrl }
      }
    } catch (error: any) {
      console.error(`${userId}: Error during play in room ${roomId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error during play",
        data: null
      }
    }
  },

  // SETS THE ROOM PAUSED STATE AND FIRES AN ASYNC DB UPDATE
  pause({
    userId,
    roomId,
    currentTime
  }: {
    userId: string,
    roomId: string,
    currentTime: number
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

      const room = getRoomResponse.data

      if (!room.users.includes(userId)) {
        return {
          success: false,
          message: "You are not in this room",
          data: null
        }
      }

      roomManager.setPlaying({ roomId, isPlaying: false, currentTime })

      roomRepo
        .updateVideoState(roomId, room.currentVideoUrl, false, currentTime)
        .catch((e) => console.error(`[video-sync-service] DB pause update failed for room ${roomId}:`, e))

      return {
        success: true,
        message: "Video playback paused",
        data: { userId, currentTime }
      }
    } catch (error: any) {
      console.error(`${userId}: Error during pause in room ${roomId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error during pause",
        data: null
      }
    }
  },

  // UPDATES THE ROOM CURRENT TIME AND FIRES AN ASYNC DB UPDATE
  seek({
    userId,
    roomId,
    currentTime
  }: {
    userId: string,
    roomId: string,
    currentTime: number
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

      const room = getRoomResponse.data

      if (!room.users.includes(userId)) {
        return {
          success: false,
          message: "You are not in this room",
          data: null
        }
      }

      roomManager.setCurrentTime({ roomId, currentTime })

      roomRepo
        .updateVideoState(roomId, room.currentVideoUrl, room.isPlaying, currentTime)
        .catch((e) => console.error(`[video-sync-service] DB seek update failed for room ${roomId}:`, e))

      return {
        success: true,
        message: "Video seeked successfully",
        data: { userId, currentTime }
      }
    } catch (error: any) {
      console.error(`${userId}: Error during seek in room ${roomId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error during seek",
        data: null
      }
    }
  },
}
