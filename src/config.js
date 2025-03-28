import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

// Get the directory name for the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load servers config from JSON file
function loadServersConfig() {
  try {
    // Try to read the config file from project root
    const configPath = path.resolve(__dirname, '..', 'servers-config.json')
    const configData = fs.readFileSync(configPath, 'utf8')
    const config = JSON.parse(configData)

    // Convert to our internal format
    const mcpServers = {}

    if (config.mcpServers) {
      for (const [serverName, serverConfig] of Object.entries(
        config.mcpServers
      )) {
        mcpServers[serverName] = {
          command: serverConfig.command,
          args: serverConfig.args || [],
          // Keep URL option for backward compatibility
          url: serverConfig.url || `http://localhost:3002/mcp`,
          preferStdio: true,
        }
      }
    }

    console.log('Loaded MCP server configurations:', Object.keys(mcpServers))
    return mcpServers
  } catch (error) {
    console.warn(`Could not load servers-config.json: ${error.message}`)
    console.warn('No MCP servers will be available')

    // Return empty object if file doesn't exist or can't be parsed
    return {}
  }
}

// Get MCP servers configuration
const mcpServers = loadServersConfig()

export default {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  port: process.env.PORT || 3000,
  // MCP servers configuration from servers-config.json
  mcpServers,
  // Claude model to use, with fallback to the latest version
  claudeModel: process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219',
  // Whether to only return the last tool response
  lastResponseOnly: process.env.LAST_RESPONSE_ONLY === 'true',
  // Maximum number of messages to keep in conversation history
  maxConversationHistory: parseInt(
    process.env.MAX_CONVERSATION_HISTORY || '10',
    10
  ),
}
