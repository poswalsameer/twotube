import { api } from "../../convex/_generated/api"
import { convex } from "./convex-client"

export interface SendMessageArgs {
  roomId: string
  senderId: string
  text: string
}

export const messageRepo = {
  async send(args: SendMessageArgs) {
    return convex.mutation(api.messages.sendMessage, args)
  },

  async getByRoom(roomId: string) {
    return convex.query(api.messages.getMessages, { roomId })
  },

  async deleteByRoom(roomId: string): Promise<void> {
    await convex.mutation(api.messages.deleteMessagesByRoom, { roomId })
  },
}
