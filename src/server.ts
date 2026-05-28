// Render 用 Node.js エントリーポイント
import { serve } from '@hono/node-server'
import app from './index.tsx'

const port = parseInt(process.env.PORT || '3000')

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`🚀 上中黒板起動: http://localhost:${info.port}`)
})
