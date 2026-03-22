import "dotenv/config"
import express from "express"
import { createServer } from "http"
import cors from "cors"
import { initSocketServer } from "./socket/socket-server"

const app = express()
const httpServer = createServer(app)

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  })
)
app.use(express.json())

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// ── Socket.io ─────────────────────────────────────────────────────────────────
initSocketServer(httpServer)

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001)

httpServer.listen(PORT, () => {
  console.log(`🚀  TwoTube server listening on http://localhost:${PORT}`)
})

export default app
