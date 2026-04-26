export type RoomState = {
  roomId: string
  hostId: string
  guestId: string | null
  users: string[]
  sockets: Record<string, string>
  currentVideoUrl: string | null
  isPlaying: boolean
  currentTime: number
}

export type CreateRoomRequest = {
  roomId: string,
  hostId: string,
  socketId: string
}
export type CreateRoomResponse = {
  success: boolean
  message: string
  data: RoomState
}

export type DeleteRoomRequest = string
export type DeleteRoomResponse = {
  success: boolean
  message: string
  data: null
}

export type GetRoomRequest = string
export type GetRoomResponse = {
  success: boolean
  message: string
  data: RoomState | null
}

export type GetRoomByUserIdRequest = string
export type GetRoomByUserIdResponse = {
  success: boolean
  message: string
  data: RoomState | null
}

export type GetRoomBySocketIdRequest = string
export type GetRoomBySocketIdResponse = {
  success: boolean
  message: string
  data: RoomState | null
}

export type AddGuestRequest = {
  roomId: string,
  guestId: string,
  socketId: string
}
export type AddGuestResponse = {
  success: boolean
  message: string
  data: RoomState | null
}

export type RemoveUserRequest = {
  roomId: string,
  userId: string
}
export type RemoveUserResponse = {
  success: boolean
  message: string
  data: RoomState | null
}

export type SetVideoRequest = {
  roomId: string,
  url: string
}
export type SetVideoResponse = {
  success: boolean
  message: string
  data: RoomState | null
}

export type SetPlayingRequest = {
  roomId: string,
  isPlaying: boolean,
  currentTime: number
}
export type SetPlayingResponse = {
  success: boolean
  message: string
  data: RoomState | null
}

export type SetCurrentTimeRequest = {
  roomId: string,
  currentTime: number
}
export type SetCurrentTimeResponse = {
  success: boolean
  message: string
}