import { serve } from "@hono/node-server/."
import { PrismaClient } from "@prisma/client"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { gameRoutes } from "./routes/game"
import { statisticsRoutes } from "./routes/statistics"
import { Context } from "./utils/hono"

const app = new Hono<Context>()
const prisma = new PrismaClient()

app.use('*', cors({
  origin: 'http://localhost:5173', // Replace with your frontend URL
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
  credentials: true,
}))

app.use('*', async (c, next) => {
  c.set('prisma', prisma)
  await next()
})

app.route('/api/game', gameRoutes)
app.route('/api/statistics', statisticsRoutes)

const PORT = Number(process.env.PORT) || 3000
console.log(`Server is running on port ${PORT}`)

serve({
  fetch: app.fetch,
  port: PORT
})

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
