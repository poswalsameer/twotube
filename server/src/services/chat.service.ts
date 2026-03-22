import { messageRepo } from "../db/message.repo"
import { roomManager } from "../room-manager/room-manager"

export const chatService = {
  /**
   * Validates the user is in the room, then persists the message.
   * Returns the saved message ID and timestamp for broadcasting.
   */
  async sendMessage(userId: string, roomId: string, text: string) {
    const room = roomManager.getRoom(roomId)
    if (!room || !room.users.includes(userId)) {
      throw new Error("You are not in this room.")
    }

    const messageId = await messageRepo.send({ roomId, senderId: userId, text: text.trim() })

    return {
      id: messageId,
      roomId,
      senderId: userId,
      text: text.trim(),
      timestamp: Date.now(),
    }
  },
}
