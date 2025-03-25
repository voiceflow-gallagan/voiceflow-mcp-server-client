import fs from 'fs'
import path from 'path'

const createOAuthFiles = () => {
  const googleCalendarDir = path.join(
    process.cwd(),
    'mcp-servers',
    'google-calendar-mcp'
  )

  console.log('Creating OAuth files in:', googleCalendarDir)

  // Create directory if it doesn't exist
  if (!fs.existsSync(googleCalendarDir)) {
    console.log('Creating directory:', googleCalendarDir)
    fs.mkdirSync(googleCalendarDir, { recursive: true })
  }

  // Handle saved tokens
  if (process.env.GCP_SAVED_TOKENS) {
    try {
      console.log('Processing GCP_SAVED_TOKENS...')
      const tokens = JSON.parse(process.env.GCP_SAVED_TOKENS)
      const tokensPath = path.join(googleCalendarDir, '.gcp-saved-tokens.json')
      fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2))
      console.log('Created .gcp-saved-tokens.json')
    } catch (error) {
      console.error('Error parsing GCP_SAVED_TOKENS:', error)
      // Don't exit, just log the error
    }
  } else {
    console.log('GCP_SAVED_TOKENS environment variable not set')
  }

  // Handle OAuth keys
  if (process.env.GCP_OAUTH_KEYS) {
    try {
      console.log('Processing GCP_OAUTH_KEYS...')
      const keys = JSON.parse(process.env.GCP_OAUTH_KEYS)
      const keysPath = path.join(googleCalendarDir, 'gcp-oauth.keys.json')
      fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2))
      console.log('Created gcp-oauth.keys.json')
    } catch (error) {
      console.error('Error parsing GCP_OAUTH_KEYS:', error)
      // Don't exit, just log the error
    }
  } else {
    console.log('GCP_OAUTH_KEYS environment variable not set')
  }

  // Check if files exist but don't fail if they don't
  const files = ['.gcp-saved-tokens.json', 'gcp-oauth.keys.json']
  files.forEach((file) => {
    const filePath = path.join(googleCalendarDir, file)
    if (fs.existsSync(filePath)) {
      console.log(`Verified ${file} exists`)
    } else {
      console.log(`Note: ${file} was not created`)
    }
  })
}

createOAuthFiles()
