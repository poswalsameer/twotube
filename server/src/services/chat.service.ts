import { messageRepo } from "../db/message.repo"
import { roomManager } from "../room-manager/room-manager"

export const chatService = {

  // VALIDATES THE USER IS IN THE ROOM, THEN PERSISTS THE MESSAGE
  async sendMessage({
    userId,
    roomId,
    text
  }: {
    userId: string,
    roomId: string,
    text: string
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

      const cleanText = text.trim()
      if (!cleanText) {
        return {
          success: false,
          message: "Message text cannot be empty",
          data: null
        }
      }

      const messageId = await messageRepo.send({
        roomId,
        senderId: userId,
        text: cleanText
      })

      return {
        success: true,
        message: "Message sent successfully",
        data: {
          id: messageId,
          roomId,
          senderId: userId,
          text: cleanText,
          timestamp: Date.now(),
        }
      }
    } catch (error: any) {
      console.error(`${userId}: Error while sending message in room ${roomId}: ${JSON.stringify(error, null, 2)}`)
      return {
        success: false,
        message: error.message || "Error while sending message",
        data: null
      }
    }
  },
}
