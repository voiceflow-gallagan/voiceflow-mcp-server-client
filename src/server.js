import express from 'express'
import apiRoutes from './api/index.js'
import config from './config.js'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error)
  // Prevent server from crashing on uncaught exceptions
  // For critical errors, you might want to gracefully shut down instead
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason)
})

// Graceful shutdown function
function setupGracefulShutdown(server) {
  const shutdown = () => {
    console.log('Shutting down gracefully...')
    server.close(() => {
      console.log('HTTP server closed')
      process.exit(0)
    })

    // Force shutdown after 10 seconds if closing nicely doesn't work
    setTimeout(() => {
      console.error('Forcing shutdown after timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

async function startServer() {
  try {
    // Create Express app
    const app = express()

    // Add request logging middleware
    app.use((req, res, next) => {
      console.log(
        `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
      )
      next()
    })

    // Middleware
    app.use(express.json())

    // Serve static files from the public directory
    app.use(express.static(path.join(__dirname, '../public')))

    // Error handling middleware for JSON parsing errors
    app.use((err, req, res, next) => {
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON' })
      }
      next(err)
    })

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        message: 'MCP Client API is running',
        availableServers: Object.keys(config.mcpServers),
        timestamp: new Date().toISOString(),
      })
    })

    // Root endpoint - serve the chat interface
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'))
    })

    // API routes
    app.use('/api', apiRoutes)

    // Error handling for API routes
    app.use((err, req, res, next) => {
      console.error('API Error:', err)
      res.status(500).json({
        error: 'Internal Server Error',
        message:
          process.env.NODE_ENV === 'development'
            ? err.message
            : 'Something went wrong',
      })
    })

    // Catch-all route handler
    app.use('*', (req, res) => {
      res.status(404).json({ error: 'Not Found' })
    })

    // Start Express server
    const port = config.port
    const server = app.listen(port, () => {
      console.log(`API server listening on port ${port}`)
      console.log(
        `Available MCP servers: ${
          Object.keys(config.mcpServers).join(', ') || 'None'
        }`
      )
      console.log(`Chat interface available at http://localhost:${port}`)
    })

    // Setup graceful shutdown
    setupGracefulShutdown(server)

    console.log('Server started successfully')
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
