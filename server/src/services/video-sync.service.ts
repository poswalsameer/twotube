import { roomManager } from "../room-manager/room-manager"
import { roomRepo } from "../db/room.repo"

export const videoSyncService = {
  /**
   * Sets the room playing state and fires an async DB update (fire-and-forget).
   * Returns the new video state for broadcasting.
   */
  play(userId: string, roomId: string, currentTime: number, videoUrl?: string) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.users.includes(userId)) {
      throw new Error("You are not in this room.")
    }

    if (videoUrl) roomManager.setVideo(roomId, videoUrl)
    roomManager.setPlaying(roomId, true, currentTime)

    // Persist asynchronously — video sync latency must be minimal
    roomRepo
      .updateVideoState(roomId, videoUrl ?? room.currentVideoUrl, true, currentTime)
      .catch((e) => console.error("[video-sync-service] DB play update failed:", e))

    return { userId, currentTime, videoUrl }
  },

  pause(userId: string, roomId: string, currentTime: number) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.users.includes(userId)) {
      throw new Error("You are not in this room.")
    }

    roomManager.setPlaying(roomId, false, currentTime)

    roomRepo
      .updateVideoState(roomId, room.currentVideoUrl, false, currentTime)
      .catch((e) => console.error("[video-sync-service] DB pause update failed:", e))

    return { userId, currentTime }
  },

  seek(userId: string, roomId: string, currentTime: number) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.users.includes(userId)) {
      throw new Error("You are not in this room.")
    }

    roomManager.setCurrentTime(roomId, currentTime)

    roomRepo
      .updateVideoState(roomId, room.currentVideoUrl, room.isPlaying, currentTime)
      .catch((e) => console.error("[video-sync-service] DB seek update failed:", e))

    return { userId, currentTime }
  },
}
