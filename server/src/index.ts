import "dotenv/config"
import cors from "cors"
import express from "express"
import { createServer } from "http"
import { initSocketServer } from "./socket/index"

const app = express()
const httpServer = createServer(app)

// MIDDLEWARES
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  })
)
app.use(express.json())

// HEALTH CHECK ENDPOINT
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// SOCKET.IO
initSocketServer(httpServer)

const PORT = Number(process.env.PORT ?? 3001)

httpServer.listen(PORT, () => {
  console.log(`TwoTube server listening on http://localhost:${PORT}`)
})

export default app
