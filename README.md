# MCP Client

A Node.js client for the Model Context Protocol (MCP) that integrates with external MCP servers to provide tools for LLMs.

## Features

- Support for multiple external MCP servers
- Child process (stdio) and HTTP transport options
- Tool discovery and integration with Claude AI
- Configurable server integration through JSON
- Automatic cleanup and error handling

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

4. Create a `servers-config.json` file in the root directory to configure your MCP servers:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/your/weather-mcp/dist/index.js"]
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
- Automatically connect to configured MCP servers when needed

### Configuring MCP servers

This project supports integrating with external MCP servers, such as the [weather-mcp](https://github.com/nakamurau1/weather-mcp) server.

#### Configuration with servers-config.json

Configure external MCP servers using a `servers-config.json` file in the project root:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/your/weather-mcp/dist/index.js"]
    }
  }
}
```

This configuration will automatically:
1. Launch the MCP server as a child process when needed
2. Communicate with it using stdio transport
3. Make the server's tools available to the client

You can add multiple servers to the configuration:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/your/weather-mcp/dist/index.js"]
    },
    "notion": {
      "command": "python",
      "args": ["-m", "notion_mcp.server"]
    }
  }
}
```

For each server, tools will be prefixed with the server name to avoid conflicts (e.g., `weather_getWeather`).

#### Setting up the weather-mcp server

If you want to use the weather-mcp server:

1. Clone the repository:

```bash
git clone https://github.com/nakamurau1/weather-mcp.git
cd weather-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Build the server:

```bash
npm run build
```

4. Configure the path in your `servers-config.json` file:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/your/weather-mcp/dist/index.js"]
    }
  }
}
```

5. The server will be started automatically when needed.

### Testing the API

You can test the API with curl:

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the weather in New York?"}'
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
- Proper cleanup of resource on process exit
- Detailed logging for debugging

## License

ISC
