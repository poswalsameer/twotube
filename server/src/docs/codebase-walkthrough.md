# TwoTube Backend — Full Codebase Walkthrough

> A real-time **watch-together** backend. Two users join a shared room, watch YouTube videos in sync, chat, manage a video queue, and optionally talk over WebRTC audio/video. All communication is event-driven over WebSockets (Socket.io). Convex is used for persistence.

---

## Table of Contents

1. [Big Picture](#1-big-picture)
2. [Tech Stack](#2-tech-stack)
3. [Project Layout](#3-project-layout)
4. [Layer Architecture](#4-layer-architecture)
5. [Entry Point — `index.ts`](#5-entry-point--indexts)
6. [In-Memory State — `room-manager`](#6-in-memory-state--room-manager)
7. [Database Layer — `db/`](#7-database-layer--db)
8. [Convex Functions — `convex/`](#8-convex-functions--convex)
9. [Services Layer — `services/`](#9-services-layer--services)
10. [Controllers Layer — `controllers/`](#10-controllers-layer--controllers)
11. [Socket Routes Layer — `socket/routes/`](#11-socket-routes-layer--socketroutes)
12. [Socket Server — `socket/socket-server.ts`](#12-socket-server--socketsocket-serverts)
13. [Utilities — `utils/`](#13-utilities--utils)
14. [Socket Event Reference](#14-socket-event-reference)
15. [Room Lifecycle — End to End](#15-room-lifecycle--end-to-end)
16. [Data Flow Diagrams](#16-data-flow-diagrams)
17. [Key Design Decisions](#17-key-design-decisions)
18. [Edge Cases Handled](#18-edge-cases-handled)
19. [Setup & Running](#19-setup--running)

---

## 1. Big Picture

```
Client A (Host)          Server                    Client B (Guest)
     |                     |                             |
     |--- CREATE_ROOM ----> |                             |
     |<-- ROOM_CREATED ---- |                             |
     |                     |                             |
     |                     | <---------- JOIN_ROOM ------|
     |<-- USER_JOINED ----- |                             |
     |                     | ------- ROOM_JOINED ------> |
     |                     |                             |
     |--- PLAY_VIDEO -----> |                             |
     |<-- VIDEO_PLAY ------ | ------- VIDEO_PLAY ------> |
     |                     |                             |
     |--- WEBRTC_OFFER ---> | ------- WEBRTC_OFFER -----> |
     |                     | <------ WEBRTC_ANSWER ------|
     |<-- WEBRTC_ANSWER --- |                             |
```

The server is a **stateful relay**. It keeps rooms alive in memory, broadcasts sync events to both users, and persists chat and queue to Convex. It never processes video data — it only coordinates _what_, _when_, and _who_.

---

## 2. Tech Stack

| Technology     | Role                                             |
| -------------- | ------------------------------------------------ |
| **Node.js**    | Runtime                                          |
| **Express**    | HTTP layer (health check, future REST endpoints) |
| **Socket.io**  | Real-time bidirectional events                   |
| **Convex**     | Serverless database (rooms, messages, queue)     |
| **TypeScript** | Type safety everywhere                           |
| **nanoid**     | Unique room ID generation                        |

---

## 3. Project Layout

```
server/
├── convex/                          # Convex serverless DB functions
│   ├── schema.ts                    # Table definitions + indexes
│   ├── rooms.ts                     # Room mutations & queries
│   ├── messages.ts                  # Message mutations & queries
│   ├── queue.ts                     # Queue mutations & queries
│   └── _generated/
│       └── api.ts                   # Auto-generated type-safe API (stub until `npx convex dev`)
│
├── src/
│   ├── index.ts                     # App entry point
│   │
│   ├── docs/
│   │   └── codebase-walkthrough.md  # ← you are here
│   │
│   ├── room-manager/
│   │   └── room-manager.ts          # In-memory room state singleton
│   │
│   ├── db/
│   │   ├── convex-client.ts         # Single shared ConvexHttpClient instance
│   │   ├── room.repo.ts             # Room persistence (wraps Convex mutations)
│   │   ├── message.repo.ts          # Message persistence
│   │   └── queue.repo.ts            # Queue persistence
│   │
│   ├── services/
│   │   ├── room.service.ts          # Business logic: create, join, leave, kick
│   │   ├── chat.service.ts          # Business logic: validate + persist messages
│   │   ├── video-sync.service.ts    # Business logic: play, pause, seek state
│   │   ├── queue.service.ts         # Business logic: add to queue, next video
│   │   └── cleanup.service.ts       # Shared teardown: DB delete + broadcast + memory clear
│   │
│   ├── controllers/
│   │   ├── room.controller.ts       # Socket handler for room events
│   │   ├── chat.controller.ts       # Socket handler for chat
│   │   ├── video-sync.controller.ts # Socket handler for video sync
│   │   ├── queue.controller.ts      # Socket handler for queue
│   │   └── webrtc.controller.ts     # WebRTC signalling relay
│   │
│   ├── socket/
│   │   ├── events.ts                # CLIENT_EVENTS / SERVER_EVENTS constants
│   │   ├── socket-server.ts         # io init + connect/disconnect + mounts routes
│   │   └── routes/
│   │       ├── room.routes.ts       # Binds room events → room.controller
│   │       ├── chat.routes.ts       # Binds SEND_MESSAGE → chat.controller
│   │       ├── video-sync.routes.ts # Binds PLAY/PAUSE/SEEK → video-sync.controller
│   │       ├── queue.routes.ts      # Binds ADD_TO_QUEUE/NEXT_VIDEO → queue.controller
│   │       └── webrtc.routes.ts     # Binds WEBRTC_* → webrtc.controller
│   │
│   └── utils/
│       └── generate-room-key.ts     # Human-friendly room key generator
│
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 4. Layer Architecture

The codebase follows a strict **4-layer architecture** adapted from traditional MVC for a WebSocket context:

```
Socket Event arrives
        ↓
  [ ROUTES ]          — only job: bind socket event name → controller method
        ↓
  [ CONTROLLERS ]     — validate payload, call service, emit socket events
        ↓
  [ SERVICES ]        — pure business logic, zero socket.io references
        ↓
  [ REPOS / ROOM-MANAGER ] — data access (Convex DB) and in-memory state
```

### Why this matters

- **Routes** are dead-simple. Adding a new event is one line.
- **Controllers** handle all socket-specific concerns (emitting errors, joining channels).
- **Services** are pure functions — easy to test, no socket coupling.
- **Repos** wrap all Convex calls behind a single interface. If you change your DB, you only touch repos.

---

## 5. Entry Point — `index.ts`

```
src/index.ts
```

This is the application bootstrap. It does three things:

1. **Creates an Express app** — a lightweight HTTP server. The only HTTP route is `GET /health` which returns `{ status: "ok" }`. All real work happens over WebSockets.

2. **Creates a raw Node.js `http.Server`** — wrapping Express. Socket.io attaches to this rather than Express directly, because Socket.io needs the raw server to manage WebSocket upgrades.

3. **Calls `initSocketServer(httpServer)`** — hands the HTTP server over to the socket layer.

```ts
// Simplified flow in index.ts
const app = express();
const httpServer = createServer(app);   // raw Node HTTP server

app.get("/health", ...);                // only HTTP route

initSocketServer(httpServer);           // Socket.io takes over

httpServer.listen(PORT);
```

**Environment variables read here:**

- `PORT` — which port to bind (default `3001`)
- `CLIENT_ORIGIN` — passed to CORS config

---

## 6. In-Memory State — `room-manager`

```
src/room-manager/room-manager.ts
```

### What it is

A **singleton class** (`roomManager`) that holds all active rooms in a `Map<roomId, RoomState>`. This is the real-time source of truth — every socket operation reads from and writes to this first.

### RoomState shape

```ts
interface RoomState {
  roomId: string
  hostId: string
  guestId: string | null
  users: string[] // [hostId] or [hostId, guestId]
  sockets: Record<string, string> // { userId: socketId }
  currentVideoUrl: string | null
  isPlaying: boolean
  currentTime: number
}
```

### Why in-memory?

Database round-trips (even fast ones like Convex) add latency. For real-time events like play/pause/seek that fire many times per second, reading from memory is essential. Convex is only used for persistence — recovering state after a server restart, or loading history.

### Key methods

| Method                                   | What it does                                             |
| ---------------------------------------- | -------------------------------------------------------- |
| `createRoom(roomId, hostId, socketId)`   | Creates a new RoomState and stores it                    |
| `deleteRoom(roomId)`                     | Removes the room from memory entirely                    |
| `addGuest(roomId, guestId, socketId)`    | Sets guestId and adds to users/sockets                   |
| `removeUser(roomId, userId)`             | Removes from users[], sockets{}, clears guestId if guest |
| `getRoomBySocketId(socketId)`            | Used on disconnect to find which room a socket was in    |
| `getPeerSocketId(roomId, myUserId)`      | Returns the other user's socketId for P2P signals        |
| `isFull(roomId)`                         | True if `users.length >= 2`                              |
| `isHost(roomId, userId)`                 | True if `room.hostId === userId`                         |
| `setPlaying / setVideo / setCurrentTime` | Update video state in memory                             |

---

## 7. Database Layer — `db/`

```
src/db/
  convex-client.ts
  room.repo.ts
  message.repo.ts
  queue.repo.ts
```

### `convex-client.ts`

Creates a single `ConvexHttpClient` instance, shared across all repos. It reads `CONVEX_URL` from environment.

```ts
export const convex = new ConvexHttpClient(process.env.CONVEX_URL)
```

This client lets the Node.js server call Convex mutations and queries over HTTP (as opposed to the real-time Convex subscription client used in frontends).

### `room.repo.ts`

Wraps all Convex room operations:

| Method                                | Convex call                  |
| ------------------------------------- | ---------------------------- |
| `create({ roomId, roomKey, hostId })` | `api.rooms.createRoom`       |
| `findByKey(roomKey)`                  | `api.rooms.getRoomByKey`     |
| `findById(roomId)`                    | `api.rooms.getRoomById`      |
| `updateGuest(roomId, guestId)`        | `api.rooms.updateGuest`      |
| `updateVideoState(...)`               | `api.rooms.updateVideoState` |
| `deleteRoom(roomId)`                  | `api.rooms.deleteRoom`       |

### `message.repo.ts`

| Method                             | Convex call                         |
| ---------------------------------- | ----------------------------------- |
| `send({ roomId, senderId, text })` | `api.messages.sendMessage`          |
| `getByRoom(roomId)`                | `api.messages.getMessages`          |
| `deleteByRoom(roomId)`             | `api.messages.deleteMessagesByRoom` |

### `queue.repo.ts`

| Method                               | Convex call                   |
| ------------------------------------ | ----------------------------- |
| `add({ roomId, videoUrl, addedBy })` | `api.queue.addToQueue`        |
| `getByRoom(roomId)`                  | `api.queue.getQueue`          |
| `removeFirst(roomId)`                | `api.queue.removeFirst`       |
| `deleteByRoom(roomId)`               | `api.queue.deleteQueueByRoom` |

---

## 8. Convex Functions — `convex/`

```
server/convex/
  schema.ts
  rooms.ts
  messages.ts
  queue.ts
  _generated/api.ts
```

These are **serverless functions** that run inside Convex's cloud infrastructure. When you run `npx convex dev` (from `server/`), Convex deploys these functions and generates the `_generated/api.ts` type file.

### `schema.ts` — Database tables

```
rooms
  roomId       string    (indexed)
  roomKey      string    (indexed)
  hostId       string
  guestId      string?
  currentVideoUrl string?
  isPlaying    boolean
  currentTime  number
  createdAt    number

messages
  roomId       string    (indexed)
  senderId     string
  text         string
  timestamp    number

queue
  roomId       string    (indexed)
  videoUrl     string
  addedBy      string
  order        number    (indexed with roomId for ordered queries)
```

The `order` field on queue items enables efficient ordering without sorting in application code — Convex can fetch items in insertion order via the `by_roomId_order` index.

### `rooms.ts`

Contains server-side Convex `mutation` and `query` definitions. Mutations write data; queries read it. Convex enforces these at the type level.

Key function: `updateVideoState` — called after play/pause/seek to keep Convex in sync with what's happening in memory. Called fire-and-forget from the service layer.

### `messages.ts`

- `sendMessage` — inserts a message and returns its Convex document ID (used as the broadcast message `id`)
- `deleteMessagesByRoom` — fetches all messages for a room and deletes them in a single mutation

### `queue.ts`

- `addToQueue` — queries the last `order` value for the room, adds 1, and inserts with the next order. This ensures correct ordering without race conditions (Convex mutations are transactional).
- `removeFirst` — queries the first item by `by_roomId_order` and deletes it
- `deleteQueueByRoom` — bulk delete all queue items for a room

---

## 9. Services Layer — `services/`

Services contain **pure business logic**. They receive plain values (strings, numbers), interact with repos and room-manager, and return plain data. They never touch `socket` or `io`.

### `room.service.ts`

The most important service. Handles all room lifecycle logic.

**`createRoom(userId, socketId)`**

1. Generates a unique `roomId` via `nanoid()`
2. Generates a human-friendly `roomKey` via `generateRoomKey()` (e.g. `"XK9-A3B"`)
3. Creates the room in memory via `roomManager.createRoom()`
4. Persists to Convex via `roomRepo.create()`
5. Returns `{ room, roomKey }` — the controller handles emitting

**`joinRoom(userId, roomKey, socketId)`**

1. Looks up the room by `roomKey` from Convex (Convex is the authority on valid keys)
2. Cross-references with in-memory state to confirm the room is still active
3. Validates: user not already in room, room not full
4. Adds the guest to memory and updates Convex
5. Returns the updated room (containing video state) so the controller can send a full sync snapshot to the new guest

**`removeUser(roomId, userId)`** — removes from memory only. The controller decides what to do next (cleanup if host/empty, or just notify).

**`kickGuest(roomId, hostId)`** — validates host permission, removes guest from memory, returns `{ guestId, guestSocketId }` so the controller can force-disconnect the specific socket.

**Convenience methods** exposed to other layers: `isHost`, `getRoom`, `getRoomBySocketId`, `getUserIdBySocketId` — these are thin wrappers over room-manager so the controller never accesses room-manager directly.

---

### `cleanup.service.ts`

Used in 4 scenarios: host deletes, host disconnects, both users leave, or guest disconnects and room becomes empty.

```
cleanupRoom(roomId, io)
  ├── 1. Look up room in memory (get socket IDs before we delete)
  ├── 2. Delete messages, queue, and room from Convex (parallel, allSettled)
  ├── 3. Emit ROOM_DELETED to every connected socket in the room
  └── 4. Delete from room-manager memory
```

`Promise.allSettled` is used (not `Promise.all`) so that if one Convex deletion fails (e.g. a network hiccup), the others still complete and the room is still cleaned up locally.

---

### `chat.service.ts`

**`sendMessage(userId, roomId, text)`**

1. Validates the user is actually in the room (via room-manager)
2. Persists to Convex via `messageRepo.send()`
3. Returns a message object (with Convex-generated ID + server timestamp) for the controller to broadcast

---

### `video-sync.service.ts`

Three methods: `play`, `pause`, `seek`.

All follow the same pattern:

1. Validate user is in the room
2. Update in-memory state immediately (zero latency for the broadcast)
3. Fire off a Convex update **asynchronously with `.catch()` logging** — we intentionally don't `await` this
4. Return the data for the controller to broadcast

**Why fire-and-forget for video state?**
Video sync events (especially seek) fire rapidly. Adding a Convex round-trip (even 50-100ms) before broadcasting would cause noticeable lag between users. The UI experience would be ruined. We accept the tiny risk that Convex could temporarily be slightly stale — it'll be corrected on the next event.

---

### `queue.service.ts`

**`addToQueue(userId, roomId, videoUrl)`**

1. Validates user is in room
2. Persists via `queueRepo.add()` — Convex assigns the next `order` value atomically
3. Fetches the full updated queue from Convex
4. Returns the queue for broadcasting

**`nextVideo(userId, roomId)`**

1. Fetches the current queue from Convex
2. Takes the first item (`queue[0]`)
3. Removes it from Convex (`queueRepo.removeFirst()`)
4. Updates in-memory video state to reflect the new video playing at `currentTime: 0`
5. Fetches and returns the updated queue + the next video info
6. The controller then broadcasts both `QUEUE_UPDATED` and `VIDEO_PLAY`

---

## 10. Controllers Layer — `controllers/`

Controllers sit between routes and services. They:

- Validate that required payload fields are present
- Call service methods wrapped in try/catch
- React to results by emitting socket events
- Convert service errors (thrown as `Error`) into `SERVER_EVENTS.ERROR` emits

### `room.controller.ts`

The largest controller. Has 5 methods:

**`createRoom`**

- Calls `roomService.createRoom()`
- Calls `socket.join(room.roomId)` — subscribes the socket to the Socket.io room channel for future `io.to(roomId).emit(...)` calls
- Emits `ROOM_CREATED` with `{ roomId, roomKey, hostId }`

**`joinRoom`**

- Calls `roomService.joinRoom()`
- Calls `socket.join(room.roomId)` for the guest
- Emits `USER_JOINED` to the host's specific socket (not the whole room since the guest isn't in the channel yet when this fires conceptually)
- Emits `ROOM_JOINED` to the guest with full video sync state (`currentVideoUrl`, `isPlaying`, `currentTime`) — this is the new user's initial sync

**`leaveRoom`**

- Checks if the leaving user was the host
- Calls `roomService.removeUser()`
- Calls `socket.leave(roomId)`
- If host → `cleanupRoom()` (full teardown)
- If guest leaves and room is now empty → `cleanupRoom()`
- Otherwise → emits `USER_LEFT` to remaining user

**`deleteRoom`**

- Validates the requester is the host
- Delegates entirely to `cleanupRoom()`

**`kickUser`**

- Calls `roomService.kickGuest()` to get `{ guestId, guestSocketId }`
- Used `io.sockets.sockets.get(guestSocketId)` to retrieve the actual socket object
- Forces it out of the room channel with `guestSocket.leave(roomId)`
- Emits `USER_KICKED` to the guest
- Emits `USER_LEFT` to the host (so host's UI updates)

### `chat.controller.ts`

Validates `userId`, `roomId`, `text` are present. Calls `chatService.sendMessage()`. Broadcasts `MESSAGE_RECEIVED` to the entire room (`io.to(roomId).emit()`).

### `video-sync.controller.ts`

- `play` and `pause` → `io.to(roomId).emit()` — broadcast to **everyone including sender** so the sender's player also receives the canonical event
- `seek` → `socket.to(roomId).emit()` — broadcast to **peers only, not sender**, because the sender already applied the seek locally

### `queue.controller.ts`

Both `addToQueue` and `nextVideo` broadcast `QUEUE_UPDATED` to the whole room. `nextVideo` additionally broadcasts `VIDEO_PLAY` so both clients start playing the new video from `currentTime: 0`.

### `webrtc.controller.ts`

The simplest controller. Has a private `forwardToPeer` helper that:

1. Uses `roomManager.getPeerSocketId(roomId, userId)` to find the other user's socket
2. Emits the signal payload directly to that socket via `io.to(peerSocketId).emit()`

The server **never inspects** the WebRTC payload — it just passes it through. The `sdp` and `candidate` fields are typed as `Record<string, any>` to reflect this.

Three methods: `offer`, `answer`, `ice` — all delegate to `forwardToPeer` with the appropriate event name.

---

## 11. Socket Routes Layer — `socket/routes/`

Each routes file is just a function that registers event listeners on a `socket`. All 5 route files follow the same pattern:

```ts
export function registerXRoutes(socket: Socket, io: Server) {
  socket.on(CLIENT_EVENTS.SOME_EVENT, (payload) =>
    someController.method(payload, socket, io),
  )
}
```

This separation means:

- **Adding a new event** = add one `socket.on` line in the right routes file
- **Routes never contain logic** — they're purely declarative
- **Socket server stays clean** — it just calls `registerXRoutes(socket, io)` per connection

The 5 route groups:

| File                   | Events registered                                          |
| ---------------------- | ---------------------------------------------------------- |
| `room.routes.ts`       | CREATE_ROOM, JOIN_ROOM, LEAVE_ROOM, DELETE_ROOM, KICK_USER |
| `chat.routes.ts`       | SEND_MESSAGE                                               |
| `video-sync.routes.ts` | PLAY_VIDEO, PAUSE_VIDEO, SEEK_VIDEO                        |
| `queue.routes.ts`      | ADD_TO_QUEUE, NEXT_VIDEO                                   |
| `webrtc.routes.ts`     | WEBRTC_OFFER, WEBRTC_ANSWER, WEBRTC_ICE                    |

---

## 12. Socket Server — `socket/socket-server.ts`

```
src/socket/socket-server.ts
```

The orchestrator. Called once from `index.ts` with the HTTP server.

**What it does on startup:**

- Creates the `Socket.io Server` instance with CORS settings and ping timeouts
- Listens for `connection` events

**What it does per connection (inside `io.on("connection", ...)`):**

1. Logs the new connection with its socket ID
2. Mounts all 5 route groups by calling each `registerXRoutes(socket, io)`
3. Registers the `disconnect` handler

**Disconnect logic:**

```
ON DISCONNECT:
  1. Find which room this socket belonged to (via roomService.getRoomBySocketId)
  2. Find which userId this socket belonged to (via roomService.getUserIdBySocketId)
  3. Remove the user from room-manager memory
  4. If they were the HOST → cleanupRoom() (full teardown + ROOM_DELETED broadcast)
  5. If they were the GUEST and room is now empty → cleanupRoom()
  6. If they were the GUEST and host is still there → emit USER_LEFT to the room
```

This mirrors the explicit `LEAVE_ROOM` logic — disconnects are treated identically to a voluntary leave.

---

## 13. Utilities — `utils/`

### `generate-room-key.ts`

Generates a short, human-typeable room key like `XK9-A3B`.

- Uses `nanoid` with a custom alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
  - Excludes ambiguous characters: `I`, `O`, `0`, `1` (hard to distinguish visually)
- Generates 7 characters, then formats as `XXX-XXXX`
- This key is what guests use to join. The `roomId` (a full nanoid) is internal.

---

## 14. Socket Event Reference

### Client → Server

| Event           | Payload                                      | Description                            |
| --------------- | -------------------------------------------- | -------------------------------------- |
| `CREATE_ROOM`   | `{ userId }`                                 | Create a new room; caller becomes host |
| `JOIN_ROOM`     | `{ userId, roomKey }`                        | Join by human-readable key             |
| `LEAVE_ROOM`    | `{ userId, roomId }`                         | Graceful leave                         |
| `DELETE_ROOM`   | `{ userId, roomId }`                         | Host force-deletes the room            |
| `KICK_USER`     | `{ hostId, roomId }`                         | Host removes the guest                 |
| `SEND_MESSAGE`  | `{ userId, roomId, text }`                   | Send a chat message                    |
| `PLAY_VIDEO`    | `{ userId, roomId, currentTime, videoUrl? }` | Start/resume playback                  |
| `PAUSE_VIDEO`   | `{ userId, roomId, currentTime }`            | Pause playback                         |
| `SEEK_VIDEO`    | `{ userId, roomId, currentTime }`            | Scrub to position                      |
| `ADD_TO_QUEUE`  | `{ userId, roomId, videoUrl }`               | Add video to the shared queue          |
| `NEXT_VIDEO`    | `{ userId, roomId }`                         | Pop next video from queue and play it  |
| `WEBRTC_OFFER`  | `{ userId, roomId, sdp }`                    | Send WebRTC SDP offer to peer          |
| `WEBRTC_ANSWER` | `{ userId, roomId, sdp }`                    | Send WebRTC SDP answer to peer         |
| `WEBRTC_ICE`    | `{ userId, roomId, candidate }`              | Send ICE candidate to peer             |

### Server → Client

| Event              | Payload                                                       | Who receives it                 |
| ------------------ | ------------------------------------------------------------- | ------------------------------- |
| `ROOM_CREATED`     | `{ roomId, roomKey, hostId }`                                 | Host only                       |
| `ROOM_JOINED`      | `{ roomId, hostId, currentVideoUrl, isPlaying, currentTime }` | Guest only (sync snapshot)      |
| `USER_JOINED`      | `{ userId, roomId }`                                          | Host only                       |
| `USER_LEFT`        | `{ userId, roomId }`                                          | Remaining user                  |
| `ROOM_DELETED`     | `{ roomId }`                                                  | All users in room               |
| `USER_KICKED`      | `{ roomId }`                                                  | Kicked guest only               |
| `MESSAGE_RECEIVED` | `{ id, roomId, senderId, text, timestamp }`                   | All in room                     |
| `VIDEO_PLAY`       | `{ userId, currentTime, videoUrl? }`                          | All in room                     |
| `VIDEO_PAUSE`      | `{ userId, currentTime }`                                     | All in room                     |
| `VIDEO_SEEK`       | `{ userId, currentTime }`                                     | Peer only (not sender)          |
| `QUEUE_UPDATED`    | `{ queue }`                                                   | All in room                     |
| `WEBRTC_OFFER`     | `{ userId, roomId, sdp }`                                     | Peer only                       |
| `WEBRTC_ANSWER`    | `{ userId, roomId, sdp }`                                     | Peer only                       |
| `WEBRTC_ICE`       | `{ userId, roomId, candidate }`                               | Peer only                       |
| `ERROR`            | `{ message }`                                                 | Socket that triggered the error |

---

## 15. Room Lifecycle — End to End

### Creating a Room

```
Client emits CREATE_ROOM { userId }
  → room.routes.ts receives it
  → room.controller.createRoom() is called
      → validates userId present
      → roomService.createRoom(userId, socket.id)
          → nanoid() generates roomId
          → generateRoomKey() generates roomKey ("XK9-A3B")
          → roomManager.createRoom() stores in memory
          → roomRepo.create() persists to Convex
          → returns { room, roomKey }
      → socket.join(roomId)  ← socket subscribes to this channel
      → emits ROOM_CREATED { roomId, roomKey, hostId } back to creator
```

### Joining a Room

```
Client emits JOIN_ROOM { userId, roomKey }
  → room.routes.ts receives it
  → room.controller.joinRoom() is called
      → validates userId, roomKey present
      → roomService.joinRoom(userId, roomKey, socket.id)
          → roomRepo.findByKey(roomKey)  ← Convex query (validates key is real)
          → roomManager.getRoom(roomId)  ← confirm still active in memory
          → validates: not already in room, not full
          → roomManager.addGuest()  ← adds to memory
          → roomRepo.updateGuest()  ← updates Convex document
          → returns updated room state
      → socket.join(roomId)  ← guest joins the channel
      → socket.to(hostSocketId).emit(USER_JOINED)  ← tells host someone arrived
      → socket.emit(ROOM_JOINED { ...videoState })  ← sends guest a full sync snapshot
```

### Playing a Video

```
Host emits PLAY_VIDEO { userId, roomId, currentTime, videoUrl }
  → video-sync.routes.ts receives it
  → video-sync.controller.play() is called
      → videoSyncService.play(userId, roomId, currentTime, videoUrl)
          → validates user in room
          → roomManager.setVideo() + setPlaying()  ← instant memory update
          → roomRepo.updateVideoState()  ← fire-and-forget async Convex update
          → returns { userId, currentTime, videoUrl }
      → io.to(roomId).emit(VIDEO_PLAY, data)  ← broadcasts to ENTIRE room (host + guest)
```

### Host Disconnects

```
Socket disconnects (network drop, close tab, etc.)
  → socket-server.ts disconnect handler fires
      → roomService.getRoomBySocketId(socket.id)  ← finds their room
      → roomService.getUserIdBySocketId(socket.id)  ← finds their userId
      → roomService.removeUser(roomId, userId)  ← removes from memory
      → roomService.isHost(roomId, userId) === true
          → cleanupRoom(roomId, io)
              → Promise.allSettled([
                    messageRepo.deleteByRoom(roomId),
                    queueRepo.deleteByRoom(roomId),
                    roomRepo.deleteRoom(roomId)
                ])
              → io.to(guestSocketId).emit(ROOM_DELETED)
              → roomManager.deleteRoom(roomId)
```

### Kicking a Guest

```
Host emits KICK_USER { hostId, roomId }
  → room.controller.kickUser()
      → roomService.kickGuest(roomId, hostId)
          → validates hostId is actually host
          → gets guestId + guestSocketId from memory
          → roomManager.removeUser(roomId, guestId)
          → returns { guestId, guestSocketId }
      → io.sockets.sockets.get(guestSocketId).leave(roomId)  ← force-removes from channel
      → io.to(guestSocketId).emit(USER_KICKED)  ← notifies guest
      → socket.emit(USER_LEFT)  ← tells host the guest is gone
```

---

## 16. Data Flow Diagrams

### Two Sources of Truth

```
                         ┌─────────────────┐
                         │   room-manager  │  ← In-Memory
                         │   (Map<id,Room>)│  ← Active rooms only
                         └────────┬────────┘  ← Fastest to read/write
                                  │ reads/writes on every event
                         ┌────────▼────────┐
                         │    services     │
                         └────────┬────────┘
                                  │ reads/writes on:
                                  │   create room
                                  │   join room
                                  │   messages
                                  │   queue changes
                                  │   video state (async)
                                  │   cleanup
                         ┌────────▼────────┐
                         │   db / repos    │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │     Convex      │  ← Persistent DB
                         │   (Cloud DB)    │  ← Survives server restarts
                         └─────────────────┘
```

### WebRTC Signalling Flow

```
Host (Caller)              Server                  Guest (Callee)
     |                       |                           |
     |-- WEBRTC_OFFER ------> |                           |
     |                       | -- WEBRTC_OFFER ---------> |
     |                       |                           |
     |                       | <-- WEBRTC_ANSWER ---------|
     |<-- WEBRTC_ANSWER ----- |                           |
     |                       |                           |
     |-- WEBRTC_ICE --------> |                           |
     |                       | -- WEBRTC_ICE -----------> |
     |                       | <-- WEBRTC_ICE ------------|
     |<-- WEBRTC_ICE -------- |                           |
     |                       |                           |
     |<====== Direct P2P audio/video (no server) ======>|
```

The server only relays the SDP and ICE handshake. Once the connection is established, audio/video flows directly peer-to-peer — the server is completely out of that path.

---

## 17. Key Design Decisions

### Memory-first, DB-second

Every read during an active session hits in-memory `roomManager` — no Convex round-trip needed. Convex is written to for:

- Initial room creation & join (must be consistent)
- Messages (need history)
- Queue (need persistence across re-joins)
- Video state (async, acceptable to be slightly stale)

### Fire-and-forget video sync writes

`PLAY_VIDEO`, `PAUSE_VIDEO`, and `SEEK_VIDEO` update the DB asynchronously. The broadcast to clients happens before the DB write completes. This trades perfect DB consistency for zero-latency sync. The DB is only needed for recovery (e.g., guest rejoins after disconnect) — and in that case, they get the latest in-memory state from `ROOM_JOINED` anyway.

### Host has all the power

The `hostId` is stored in the room and never changes. All privileged operations (delete, kick) check `roomManager.isHost()` first. If the host leaves for any reason (voluntary, disconnect, error), the entire room is destroyed — there's no host reassignment logic.

### Room key vs Room ID

- **roomKey** (`XK9-A3B`) — the human-shareable string. Guests use this to join. Authoritative in Convex.
- **roomId** (nanoid, e.g. `V1StGXR8_Z5jdHi6B-myT`) — the internal identifier. Used in all socket events and memory lookups after joining.

This separation means you could theoretically change the key format, add expiry to keys, or make keys reusable without touching internal room logic.

### Socket.io rooms mirror in-memory rooms

When a user creates or joins a room, their socket is subscribed to a Socket.io "room" channel with the same `roomId` via `socket.join(roomId)`. This lets us do `io.to(roomId).emit(...)` to reach everyone without maintaining our own broadcast loop.

---

## 18. Edge Cases Handled

| Scenario                                    | How it's handled                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Guest tries to join full room**           | `isFull()` check in `roomService.joinRoom()` → `ERROR` event                           |
| **Invalid room key**                        | `roomRepo.findByKey()` returns null → `ERROR` event                                    |
| **User tries to join their own room again** | `users.includes(userId)` check → `ERROR` event                                         |
| **Host disconnects**                        | `disconnect` handler calls `cleanupRoom()` → full teardown                             |
| **Guest disconnects**                       | Room checked for emptiness; if empty → `cleanupRoom()`; otherwise `USER_LEFT`          |
| **Both users disconnect**                   | Second disconnect finds empty room → `cleanupRoom()`                                   |
| **Host deletes while guest is inside**      | `cleanupRoom()` emits `ROOM_DELETED` to all sockets including guest                    |
| **WebRTC signal with no peer**              | `getPeerSocketId()` returns undefined → `ERROR` event to sender                        |
| **Queue empty on NEXT_VIDEO**               | Checked in `queueService.nextVideo()` → `ERROR` event                                  |
| **Non-host sends DELETE_ROOM**              | `isHost()` check in controller → `ERROR` event                                         |
| **Non-host sends KICK_USER**                | `isHost()` check in `roomService.kickGuest()` → thrown Error → `ERROR` event           |
| **DB write failure during cleanup**         | `Promise.allSettled()` ensures all 3 deletes attempt regardless of individual failures |
| **Message sent to non-existent room**       | `roomManager.getRoom()` check in `chatService` → thrown error → `ERROR` event          |

---

## 19. Setup & Running

### Prerequisites

- Node.js 18+
- A Convex account — [convex.dev](https://convex.dev)

### First-time setup

**Step 1: Install dependencies**

```bash
cd server
npm install
```

**Step 2: Initialize Convex**

Run from inside the `server/` directory (since that's where `convex/` lives):

```bash
npx convex dev
```

This will:

- Prompt you to log in / create a Convex project
- Push your schema and functions to Convex cloud
- Generate `convex/_generated/api.ts` with full type safety
- Give you a `CONVEX_URL` to copy

**Step 3: Configure environment**

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=3001
CONVEX_URL=https://your-project.convex.cloud   # from step 2
CLIENT_ORIGIN=http://localhost:3000            # your frontend URL
```

**Step 4: Run the server**

```bash
npm run dev      # development (ts-node-dev with hot reload)
npm run build    # compile TypeScript to dist/
npm start        # run compiled output
```

**Step 5: Verify**

```
GET http://localhost:3001/health
→ { "status": "ok", "timestamp": "..." }
```

### Notes on `convex/_generated/api.ts`

The file at `convex/_generated/api.ts` is a **stub** checked into the repo so TypeScript doesn't error before the first `npx convex dev` run. On first `npx convex dev`, Convex replaces it with the real, fully-typed API client generated from your schema. You should commit the real generated file to your repo after the first run so teammates don't need to run `convex dev` just to get TypeScript passing.
