# MCP Client

A Node.js client for the Model Context Protocol (MCP) that integrates with remote MCP servers to provide tools for LLMs.

## Features

- Support for multiple remote MCP servers
- HTTP transport for server communication
- Tool discovery and integration with Claude AI
- Configurable server integration through JSON
- Automatic error handling and retries

## Setup

### Prerequisites

- Node.js 20.x or higher
- npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.template` to create a new `.env` file:
   ```bash
   cp .env.template .env
   ```
   - Update the `.env` file with your actual values:
   ```
   ANTHROPIC_API_KEY=your-anthropic-api-key
   CLAUDE_MODEL=claude-3-5-sonnet-20241022
   PORT=3000
   BRAVE_API_KEY=your-brave-api-key
   LAST_RESPONSE_ONLY=false
   SERVER_DISCOVERY_TIMEOUT=30000
   ZAPIER_MCP_URL=https://actions.zapier.com/mcp/your-api-key/sse
   MAX_CONVERSATION_HISTORY=10
   ```

   Required environment variables:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude AI
   - `CLAUDE_MODEL`: The Claude model to use (default: claude-3-5-sonnet-20241022)
   - `PORT`: The port number for the server (default: 3000)
   - `BRAVE_API_KEY`: Your Brave Search API key for search functionality
   - `LAST_RESPONSE_ONLY`: When set to "true", only the last tool response will be returned in the API response (default: false)
   - `SERVER_DISCOVERY_TIMEOUT`: Maximum time in milliseconds to wait for server discovery (default: 60000ms)
   - `ZAPIER_MCP_URL`: Optional URL for the Zapier MCP server (e.g., https://actions.zapier.com/mcp/your-api-key/sse)
   - `MAX_CONVERSATION_HISTORY`: Maximum number of messages to keep in conversation history (default: 10)

### Dynamic Server Configuration

The client supports dynamic server configuration through environment variables. Currently, this feature is only available for the Zapier MCP server. This allows you to:
- Enable/disable the Zapier server without modifying the code
- Configure the Zapier server with your API key securely
- Add the Zapier server without code changes

Example of dynamic server configuration:
1. Add the Zapier server URL to your `.env` file:
   ```
   ZAPIER_MCP_URL=https://actions.zapier.com/mcp/your-api-key/sse
   ```

2. The Zapier server will be automatically configured when the application starts.

3. To disable the Zapier server, simply remove or comment out the `ZAPIER_MCP_URL` environment variable.

Note: While the dynamic server configuration feature is currently limited to the Zapier server, the architecture supports adding more dynamic servers in the future.

### Google Calendar Setup

To use the Google Calendar MCP server, you need to set up OAuth 2.0 credentials and add them to your environment variables:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop app" as the application type
   - Download the client configuration file

5. Add these environment variables to your `.env` file:
   ```
   GCP_SAVED_TOKENS={"access_token":"your-access-token","scope":"https://www.googleapis.com/auth/calendar","token_type":"Bearer","expiry_date":1234567890,"refresh_token":"your-refresh-token"}
   GCP_OAUTH_KEYS={"installed":{"client_id":"your-client-id","project_id":"your-project-id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"your-client-secret","redirect_uris":["http://localhost"]}}
   ```

   Note: The values should be the entire JSON content as a single line. You can get these values from:
   - `GCP_SAVED_TOKENS`: After the first OAuth flow, the tokens will be saved in `.gcp-saved-tokens.json`
   - `GCP_OAUTH_KEYS`: From the downloaded client configuration file

4. Create a `servers-config.json` file in the root directory to configure your remote MCP servers:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      }
    },
    "time-mcp": {
      "command": "npx",
      "args": ["-y", "time-mcp"]
    },
    "weather-server": {
      "command": "node",
      "args": ["mcp-servers/weather-mcp-server/build/index.js"],
      "env": {
        "OPENWEATHER_API_KEY": "${OPENWEATHER_API_KEY}"
      },
      "disabled": false,
      "autoApprove": []
    },
    "google-calendar": {
      "command": "node",
      "args": ["./mcp-servers/google-calendar-mcp/build/index.js"]
    }
  }
}
```

Server configuration supports:
- Command-based servers (using `command` and `args`)
- Environment variable substitution (using `${VARIABLE_NAME}`)
- Disabling servers (using `disabled: true`)
- Auto-approval for specific tools (using `autoApprove`)

For each server, tools will be prefixed with the server name to avoid conflicts (e.g., `weather_getWeather`).

Currently, dynamic server configuration through environment variables is only supported for the Zapier server. This allows you to configure the Zapier server's URL and API key through the `ZAPIER_MCP_URL` environment variable. The architecture supports adding more dynamic servers in the future.

## Usage

### Running the client

Start the API server:

```bash
npm start
```

This will:
- Start the API server on port 3000 (or the port specified in your .env file)
- Automatically connect to configured remote MCP servers when needed

### Configuring Remote MCP Servers

This project supports integrating with remote MCP servers. You can configure them using a `servers-config.json` file in the project root:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      }
    },
    "time-mcp": {
      "command": "npx",
      "args": ["-y", "time-mcp"]
    },
    "weather-server": {
      "command": "node",
      "args": ["mcp-servers/weather-mcp-server/build/index.js"],
      "env": {
        "OPENWEATHER_API_KEY": "${OPENWEATHER_API_KEY}"
      },
      "disabled": false,
      "autoApprove": []
    },
    "google-calendar": {
      "command": "node",
      "args": ["./mcp-servers/google-calendar-mcp/build/index.js"]
    }
  }
}
```

Server configuration supports:
- Command-based servers (using `command` and `args`)
- Environment variable substitution (using `${VARIABLE_NAME}`)
- Disabling servers (using `disabled: true`)
- Auto-approval for specific tools (using `autoApprove`)

For each server, tools will be prefixed with the server name to avoid conflicts (e.g., `weather_getWeather`).

Currently, dynamic server configuration through environment variables is only supported for the Zapier server. This allows you to configure the Zapier server's URL and API key through the `ZAPIER_MCP_URL` environment variable. The architecture supports adding more dynamic servers in the future.

## API Endpoints

### Health Check
```http
GET /
```
Returns the current status of the API and available MCP servers.

Response:
```json
{
  "status": "ok",
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"],
      "disabled": false
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      },
      "disabled": false
    },
    "time-mcp": {
      "command": "npx",
      "args": ["-y", "time-mcp"],
      "disabled": false
    },
    "weather-server": {
      "command": "node",
      "args": ["mcp-servers/weather-mcp-server/build/index.js"],
      "env": {
        "OPENWEATHER_API_KEY": "${OPENWEATHER_API_KEY}"
      },
      "disabled": false,
      "autoApprove": []
    },
    "google-calendar": {
      "command": "node",
      "args": ["./mcp-servers/google-calendar-mcp/build/index.js"],
      "disabled": false
    }
  }
}
```

### Process Query
```http
POST /api/query
```
Process a user query using available MCP tools and Claude AI.

Request body:
```json
{
  "query": "What is the weather in New York?",
  "conversationId": "optional-conversation-id",
  "userId": "optional-user-id",
  "userEmail": "optional-user-email",
  "queryTimeoutMs": 30000,
  "llm_answer": false
}
```

Response:
```json
{
  "query": "What is the weather in New York?",
  "answer": "The AI's response here",
  "conversationId": "conv-123456789",
  "userId": "user-123",
  "needsClarification": false,
  "noAnswer": false,
  "error": false,
  "toolResponses": [
    {
      "tool": "weather_getWeather",
      "input": { "location": "New York" },
      "response": "The current temperature is 72°F with sunny conditions.",
      "server": "weather"
    }
  ]
}
```

When `LAST_RESPONSE_ONLY=true` is set in the environment, only the last tool response will be returned. For example, if multiple tools are called:
```json
{
  "toolResponses": [
    {
      "tool": "time_getTime",
      "input": { "location": "New York" },
      "response": "The current time is 2:30 PM EDT",
      "server": "time"
    }
  ]
}
```

Available parameters:
- `query` (required): The user's question or request
- `conversationId` (optional): ID to maintain conversation context. If not provided, a new conversation will be created
- `userId` (optional): ID of the user making the request
- `userEmail` (optional): Email of the user, used for calendar-related tools
- `queryTimeoutMs` (optional): Maximum time in milliseconds to wait for a response. Defaults to 30000ms (30 seconds)
- `llm_answer` (optional): Whether to generate a final answer using Claude. If false, only tool responses will be returned. Defaults to false.

The API will return a JSON response with:
- `query`: The original query
- `answer`: The AI's response (null if llm_answer is false)
- `conversationId`: The ID of the conversation (new or existing)
- `userId`: The ID of the user (if provided)
- `needsClarification`: Boolean indicating if the AI needs more information
- `noAnswer`: Boolean indicating if the AI cannot answer the query with available tools
- `error`: Boolean indicating if an error occurred
- `toolResponses`: Array of tool responses, each containing:
  - `tool`: The name of the tool that was called
  - `input`: The input parameters passed to the tool
  - `response`: The response from the tool
  - `server`: The name of the MCP server that provided the tool
  - `error`: Boolean indicating if the tool call failed (only present if true)

### Get User Conversations
```http
GET /api/conversations/:userId
```
Retrieves all conversations for a specific user.

Parameters:
- `userId` (path parameter): The ID of the user

Response:
```json
{
  "userId": "user-123",
  "conversations": [
    {
      "conversationId": "conv-123456789",
      "firstMessage": "What is the weather in New York?",
      "lastMessage": "The current temperature is 72°F with sunny conditions.",
      "messageCount": 4
    }
  ]
}
```

### Clear Conversation
```http
DELETE /api/conversation/:conversationId
```
Clears a specific conversation.

Parameters:
- `conversationId` (path parameter): The ID of the conversation to clear

Response:
```json
{
  "success": true,
  "message": "Conversation conv-123456789 cleared successfully"
}
```

### Clear User Conversations
```http
DELETE /api/conversations/:userId
```
Clears all conversations for a specific user.

Parameters:
- `userId` (path parameter): The ID of the user

Response:
```json
{
  "success": true,
  "message": "All conversations for user user-123 cleared successfully"
}
```

### Get Available Servers
```http
GET /api/servers
```
Retrieves information about all configured MCP servers and their available actions.

Response:
```json
{
  "success": true,
  "servers": {
    "weather-server": {
      "name": "weather-server",
      "actions": [
        {
          "name": "getWeather",
          "description": "Get current weather for a location",
          "inputSchema": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "City name or location"
              }
            },
            "required": ["location"]
          }
        }
      ],
      "enabled": true
    },
    "google-calendar": {
      "name": "google-calendar",
      "actions": [
        {
          "name": "listEvents",
          "description": "List calendar events",
          "inputSchema": {
            "type": "object",
            "properties": {
              "maxResults": {
                "type": "number",
                "description": "Maximum number of events to return"
              }
            }
          }
        }
      ],
      "enabled": true
    }
  }
}
```

The response includes:
- `success`: Boolean indicating if the request was successful
- `servers`: Object containing information about each configured server:
  - `name`: The server's name
  - `actions`: Array of available actions for the server, each containing:
    - `name`: The action name
    - `description`: Description of what the action does
    - `inputSchema`: JSON Schema describing the expected input parameters
  - `enabled`: Boolean indicating if the server is enabled
  - `error`: Error message (only present if the server failed to provide its actions)

## Testing the API

You can test the API using curl:

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the weather in New York?",
    "llm_answer": false
  }'
```

Or use the included demo:
```bash
node demo.js
```

## Development

- Run in development mode: `npm run dev`
- Lint the code: `npm run lint`
- Format the code: `npm run format`

## Error Handling

The client includes several error handling mechanisms:
- Retry mechanism for connection failures
- Proper cleanup of resources
- Detailed logging for debugging

## License

ISC
