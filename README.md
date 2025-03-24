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

- Node.js 18.x or higher
- npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```
PORT=3000
ANTHROPIC_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your actual Anthropic API key.

4. Create a `servers-config.json` file in the root directory to configure your remote MCP servers:

```json
{
  "mcpServers": {
    "weather": {
      "url": "https://your-weather-mcp-server.com"
    }
  }
}
```

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
    "weather": {
      "url": "https://your-weather-mcp-server.com"
    },
    "notion": {
      "url": "https://your-notion-mcp-server.com"
    }
  }
}
```

For each server, tools will be prefixed with the server name to avoid conflicts (e.g., `weather_getWeather`).

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
    "server-name": {
      "url": "http://localhost:3000",
      "command": "node server.js",
      "args": ["--port", "3000"]
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
