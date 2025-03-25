import fs from 'fs'
import path from 'path'

const createOAuthFiles = () => {
  const googleCalendarDir = path.join(
    process.cwd(),
    'mcp-servers',
    'google-calendar-mcp'
  )

  // Create directory if it doesn't exist
  if (!fs.existsSync(googleCalendarDir)) {
    fs.mkdirSync(googleCalendarDir, { recursive: true })
  }

  // Handle saved tokens
  if (process.env.GCP_SAVED_TOKENS) {
    try {
      const tokens = JSON.parse(process.env.GCP_SAVED_TOKENS)
      fs.writeFileSync(
        path.join(googleCalendarDir, '.gcp-saved-tokens.json'),
        JSON.stringify(tokens, null, 2)
      )
    } catch (error) {
      console.error('Error parsing GCP_SAVED_TOKENS:', error)
      process.exit(1)
    }
  }

  // Handle OAuth keys
  if (process.env.GCP_OAUTH_KEYS) {
    try {
      const keys = JSON.parse(process.env.GCP_OAUTH_KEYS)
      fs.writeFileSync(
        path.join(googleCalendarDir, 'gcp-oauth.keys.json'),
        JSON.stringify(keys, null, 2)
      )
    } catch (error) {
      console.error('Error parsing GCP_OAUTH_KEYS:', error)
      process.exit(1)
    }
  }
}

createOAuthFiles()
