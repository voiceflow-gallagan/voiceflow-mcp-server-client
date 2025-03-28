import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import config from '../config.js'
import path from 'path'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
})

// Cached MCP clients (key = server name)
const cachedClients = new Map()

// Store conversation contexts (key = conversationId)
const conversationContexts = new Map()

// Create a client for an MCP server
async function createMCPClient(serverName, retryCount = 0, maxRetries = 3) {
  try {
    // Return cached client if available
    if (cachedClients.has(serverName)) {
      return cachedClients.get(serverName)
    }

    // Check if the server is configured
    if (!config.mcpServers || !config.mcpServers[serverName]) {
      throw new Error(`MCP server "${serverName}" not configured`)
    }

    const serverConfig = config.mcpServers[serverName]

    // Create a new MCP client
    const client = new Client({
      name: `voiceflow-mcp-client-${serverName}`,
      version: '1.0.0',
    })

    // Determine which transport to use based on configuration
    let transport = null

    // Check if we should use stdio transport (child process)
    if (
      (serverConfig.command && serverConfig.preferStdio !== false) ||
      !serverConfig.url
    ) {
      console.log(`Starting MCP server "${serverName}" as child process...`)

      // Get command and args
      const command = serverConfig.command || 'node'
      const args = serverConfig.args || []

      console.log(`Launching server with command: ${command} ${args.join(' ')}`)

      // Check if we have environment variables
      if (serverConfig.env) {
        console.log(
          `Server "${serverName}" environment variables:`,
          Object.keys(serverConfig.env)
        )
      } else {
        console.log(
          `No custom environment variables for server "${serverName}"`
        )
      }

      // Special handling for npx commands
      if (command === 'npx' && serverConfig.env) {
        const envArgs = []
        // Convert environment variables to command line arguments for npx
        Object.entries(serverConfig.env).forEach(([key, value]) => {
          envArgs.push('-e', `${key}=${value}`)
        })

        // Insert environment args before the package name (after any npx options)
        const npxOptionsEnd = args.findIndex((arg) => !arg.startsWith('-'))
        if (npxOptionsEnd !== -1) {
          args.splice(npxOptionsEnd, 0, ...envArgs)
        } else {
          args.push(...envArgs)
        }

        console.log(`Modified command: ${command} ${args.join(' ')}`)
      }

      // Check if args array is empty
      if (!args) {
        throw new Error(
          `Arguments not defined for command "${command}". Please check your servers-config.json.`
        )
      }

      // Create stdio transport by passing a server parameter object
      // This is the correct way to use StdioClientTransport from the SDK
      const processEnv = { ...process.env }

      // Explicitly set environment variables from the server config
      if (serverConfig.env) {
        console.log(`Setting environment variables for "${serverName}" server`)
        Object.entries(serverConfig.env).forEach(([key, value]) => {
          processEnv[key] = value
          console.log(`Set ${key}=${value.substring(0, 3)}...`)
        })
      }

      transport = new StdioClientTransport({
        command: command,
        args: args,
        // Include current working directory to resolve relative paths
        cwd: process.cwd(),
        // Pass environment variables from the server config
        env: processEnv,
      })

      console.log(`Created stdio transport for "${serverName}" server`)
    }
    // Otherwise use SSE transport
    else if (serverConfig.url) {
      console.log(`Connecting to MCP server "${serverName}" via HTTP/SSE...`)

      const sseUrl = new URL(serverConfig.url)

      // Add a unique identifier to help with debugging
      const clientId = `client-${serverName}-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`
      sseUrl.searchParams.append('clientId', clientId)

      transport = new SSEClientTransport(sseUrl)

      // Add custom event handlers for better debugging
      transport.onopen = () => {
        console.log(`SSE transport for client ${clientId} opened`)
      }

      transport.onerror = (error) => {
        console.error(`SSE transport for client ${clientId} error:`, error)
      }

      console.log(`Created SSE transport for "${serverName}" server`)
    } else {
      throw new Error(`No transport configuration for server "${serverName}"`)
    }

    // Connect the client with a timeout
    const connectTimeoutMs = serverConfig.url ? 45000 : 30000 // Longer timeout for SSE connections
    const connectPromise = client.connect(transport)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(new Error(`Connection timeout after ${connectTimeoutMs}ms`)),
        connectTimeoutMs
      )
    })

    try {
      await Promise.race([connectPromise, timeoutPromise])
      console.log(`MCP client connected to "${serverName}" server`)

      cachedClients.set(serverName, client)
      return client
    } catch (error) {
      // Close the transport if connection failed
      try {
        transport.close?.()
      } catch (closeError) {
        console.error(
          `Error closing transport after failed connection:`,
          closeError
        )
      }
      throw error
    }
  } catch (error) {
    console.error(
      `Error creating MCP client for ${serverName} (attempt ${retryCount + 1}/${
        maxRetries + 1
      }):`,
      error
    )

    if (retryCount < maxRetries) {
      // Exponential backoff retry with increasing timeout
      const delay = Math.min(2000 * Math.pow(2, retryCount), 15000)
      console.log(`Retrying in ${delay}ms...`)

      return new Promise((resolve) => {
        setTimeout(async () => {
          resolve(await createMCPClient(serverName, retryCount + 1, maxRetries))
        }, delay)
      })
    }

    throw error
  }
}

// Cleanup function for when the app exits
function setupExitHandlers() {
  const cleanup = () => {
    // Close client connections
    for (const [serverName, client] of cachedClients.entries()) {
      try {
        client.close()
        console.log(`Closed client connection to "${serverName}" server`)
      } catch (error) {
        console.error(`Error closing client for "${serverName}":`, error)
      }
    }
  }

  // Register cleanup handlers
  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })

  // For Windows
  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => {
      cleanup()
      process.exit(0)
    })
  }
}

// Set up exit handlers when this module is loaded
setupExitHandlers()

// Process a query using Claude and available MCP tools
async function processQuery({
  query,
  conversationId = null,
  userId = null,
  userEmail = null,
  queryTimeoutMs = 40000, // 30s timeout for the entire query
  llm_answer = false, // Whether to generate an LLM answer from tool responses
  lastResponseOnly = false, // Whether to return only the last tool response
}) {
  // Create a promise that will reject after the timeout
  const queryTimeout = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`Query timed out after ${queryTimeoutMs}ms`)),
      queryTimeoutMs
    )
  })

  // Wrap the actual processing in a promise that can be raced against the timeout
  const processingPromise = (async () => {
    try {
      // Create or retrieve conversation context
      if (!conversationId) {
        // Generate a new conversation ID, include userId if available
        const idPrefix = userId ? `user-${userId}-` : 'conv-'
        conversationId = `${idPrefix}${Date.now()}-${Math.floor(
          Math.random() * 1000
        )}`
      }

      let context = conversationContexts.get(conversationId) || {
        messages: [
          {
            role: 'assistant',
            content:
              'Your an AI agent trying to help with user query using available MCP tools. If you need clarification from the user, respond with a message prefixed with #CLARIFY# followed by your question. If you cannot answer the query using the available tools, respond with #NOANSWER#.',
          },
        ],
        allTools: [],
        formattedTools: [],
        userId: userId, // Store user ID in the context
        userEmail: userEmail, // Store user email in the context
      }

      // Update user info if provided in this call but not in the context
      if (userId && !context.userId) {
        context.userId = userId
      }

      if (userEmail && !context.userEmail) {
        context.userEmail = userEmail
      }

      // Helper function to sanitize server names for tool prefixes
      function sanitizeServerName(name) {
        return name.replace(/[^a-zA-Z0-9_-]/g, '_')
      }

      // Collect all available tools if not already done for this conversation
      if (context.allTools.length === 0) {
        let primaryServer = null

        // Check if we have preloaded tools in the cache
        if (global.serverCache && global.serverCache.size > 0) {
          console.log('Using preloaded tools from cache')

          // Get all tools and clients from cache
          for (const [serverName, serverData] of global.serverCache.entries()) {
            // Save the first server as primary
            if (!primaryServer) {
              primaryServer = {
                name: serverName,
                client: serverData.client,
              }
            }

            // Add tools from this server
            context.allTools.push(...serverData.tools)
          }
        } else {
          // Fallback to original discovery logic if cache is empty
          console.log(
            'No preloaded tools found, discovering tools from servers'
          )

          // Connect to and discover tools from all configured MCP servers
          // Use Promise.allSettled to continue even if some servers fail
          const serverPromises = Object.entries(config.mcpServers).map(
            async ([serverName, serverConfig]) => {
              try {
                // Set a shorter timeout for individual server tool discovery
                const serverTimeout = new Promise((_, reject) => {
                  setTimeout(
                    () =>
                      reject(
                        new Error(`Server discovery timeout for ${serverName}`)
                      ),
                    15000
                  )
                })

                const discoveryPromise = (async () => {
                  try {
                    const client = await createMCPClient(serverName, 0, 1) // Only 1 retry for initial discovery

                    const toolsResponse = await client.request(
                      { method: 'tools/list' },
                      ListToolsResultSchema
                    )

                    /* console.log(
                      `Available tools from ${serverName}:`,
                      toolsResponse.tools
                    ) */

                    // Sanitize server name for use as a prefix
                    const sanitizedServerName = sanitizeServerName(serverName)

                    // Add server prefix to tool names to avoid conflicts
                    const prefixedTools = toolsResponse.tools.map((tool) => ({
                      ...tool,
                      name: `${sanitizedServerName}_${tool.name}`,
                      originalName: tool.name,
                      serverName: serverName,
                    }))

                    return {
                      serverName,
                      client,
                      tools: prefixedTools,
                    }
                  } catch (error) {
                    console.error(
                      `Error during tool discovery for ${serverName}:`,
                      error.message
                    )
                    throw error
                  }
                })()

                // Race the discovery against timeout
                return await Promise.race([discoveryPromise, serverTimeout])
              } catch (error) {
                console.error(
                  `Error fetching tools from ${serverName}:`,
                  error.message
                )
                // Return null for failed servers
                return null
              }
            }
          )

          // Wait for all server connections to settle (either fulfill or reject)
          const results = await Promise.allSettled(serverPromises)

          // Process successful results
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
              // Save the first successful server as primary
              if (!primaryServer) {
                primaryServer = {
                  name: result.value.serverName,
                  client: result.value.client,
                }
              }

              // Add tools from this server
              context.allTools.push(...result.value.tools)
            }
          }
        }

        // Format tools for Anthropic API
        context.formattedTools = context.allTools.map((tool) => ({
          name: tool.name,
          description:
            tool.description || `Tool from ${tool.serverName} server`,
          input_schema: tool.inputSchema,
        }))

        // Save primary server reference
        context.primaryServer = primaryServer
      }

      // If no tools are available, we can't proceed
      if (context.allTools.length === 0) {
        return {
          response:
            'No MCP servers or tools available. Please check your servers-config.json file.',
          conversationId,
        }
      }

      // Add user query to conversation
      let userInstruction = ''
      // Add calendar-specific instructions if we have a user email
      if (context.userEmail) {
        userInstruction = `For Calendar related tools, use ${context.userEmail} as the target user.`
      }

      context.messages.push({
        role: 'user',
        content: `${query}\n\n${userInstruction} Try to answer using the available tools. If you need clarification, respond with #CLARIFY# followed by your question. If you cannot answer with available tools, respond with #NOANSWER#.`,
      })

      // Call Claude with the conversation history
      const response = await anthropic.messages.create({
        model: config.claudeModel,
        max_tokens: 2000,
        messages: context.messages,
        tools: context.formattedTools,
      })

      // Process any tool calls that Claude wants to make
      let finalResponse = ''
      let hasToolUse = false
      let toolResponses = []

      if (response.content.some((item) => item.type === 'tool_use')) {
        hasToolUse = true

        // Store all tools first, then process them
        const toolUsages = response.content.filter(
          (item) => item.type === 'tool_use'
        )

        // Add assistant's initial response with tool calls to context
        context.messages.push({
          role: 'assistant',
          content: response.content,
        })

        // Process all tool calls in sequence
        for (const contentItem of toolUsages) {
          const toolCall = contentItem.input
          const toolName = contentItem.name

          console.log(`Tool call requested: ${toolName} with input:`, toolCall)

          // Determine which server the tool belongs to
          let toolResponse
          const CallToolResultSchema = z
            .object({
              content: z.array(z.any()),
            })
            .passthrough()

          // Create a reverse mapping from sanitized names to original names
          const serverNameMap = {}
          for (const name of Object.keys(config.mcpServers)) {
            const sanitized = sanitizeServerName(name)
            serverNameMap[sanitized] = name
          }

          // Check for the server prefix in the tool name
          const serverPrefix = toolName.split('_')[0]
          // console.log(`Extracted server prefix: "${serverPrefix}"`)

          // For tools with multiple underscores in the prefix
          // we need to try different prefix combinations
          let originalServerName = null
          let originalToolName = null

          // Try to find the original server name by checking different possible prefixes
          const parts = toolName.split('_')

          for (let i = parts.length - 1; i > 0; i--) {
            const possiblePrefix = parts.slice(0, i).join('_')
            // console.log(`Trying possible prefix: "${possiblePrefix}"`)

            if (serverNameMap[possiblePrefix]) {
              originalServerName = serverNameMap[possiblePrefix]
              originalToolName = parts.slice(i).join('_')
              /* console.log(
                `Found match! Server: "${originalServerName}", Tool: "${originalToolName}"`
              ) */
              break
            }
          }

          // Get the appropriate client for this tool
          let client

          if (originalServerName && config.mcpServers[originalServerName]) {
            // This is a prefixed tool
            client = await createMCPClient(originalServerName)

            console.log(
              `Calling tool "${originalToolName}" on "${originalServerName}" server`
            )
          } else if (context.primaryServer) {
            // Fallback to primary server if no prefix match
            client = context.primaryServer.client
            originalToolName = toolName

            console.log(
              `No server prefix found for tool "${toolName}", using primary server "${context.primaryServer.name}"`
            )
          } else {
            throw new Error(`No server available for tool "${toolName}"`)
          }

          // Make the tool call through the appropriate MCP client
          try {
            toolResponse = await client.request(
              {
                method: 'tools/call',
                params: {
                  name: originalToolName,
                  arguments: toolCall,
                },
              },
              CallToolResultSchema
            )

            console.log('Tool response:', toolResponse)

            // Store tool response
            toolResponses.push({
              tool: toolName,
              input: toolCall,
              response: toolResponse.content[0].text,
              server: originalServerName || context.primaryServer.name,
            })

            // Add user message with tool result to context
            context.messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: contentItem.id,
                  content: toolResponse.content[0].text,
                },
              ],
            })
          } catch (error) {
            console.error(`Error calling tool ${originalToolName}:`, error)

            // Store error response
            toolResponses.push({
              tool: toolName,
              input: toolCall,
              response: `Error: ${error.message}`,
              server: originalServerName || context.primaryServer.name,
              error: true,
            })

            // Add error as tool result
            context.messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: contentItem.id,
                  content: `Error calling tool: ${error.message}`,
                },
              ],
            })
          }
        }

        // If llm_answer is false, return tool responses without generating a final answer
        if (!llm_answer) {
          // Process any follow-up tool calls before returning
          const followUpResponse = await anthropic.messages.create({
            model: config.claudeModel,
            max_tokens: 2000,
            messages: context.messages,
            tools: context.formattedTools,
          })

          // If there are more tool calls, process them recursively
          if (
            followUpResponse.content.some((item) => item.type === 'tool_use')
          ) {
            console.log('Processing follow-up tool calls before returning')
            const followUpResult = await processFollowUpToolCalls(
              context,
              followUpResponse,
              context.formattedTools,
              config.claudeModel
            )

            // Merge tool responses from follow-up calls
            toolResponses = [
              ...toolResponses,
              ...(followUpResult.toolResponses || []),
            ]
          }

          return {
            response: null,
            conversationId,
            userId: context.userId,
            needsClarification: false,
            noAnswer: false,
            toolResponses,
          }
        }

        // After processing all tools, get the final response from Claude
        const finalFollowUpResponse = await anthropic.messages.create({
          model: config.claudeModel,
          max_tokens: 2000,
          messages: context.messages,
          tools: context.formattedTools, // Keep tools available for potential follow-up calls
        })

        // Process the response
        for (const followUpItem of finalFollowUpResponse.content) {
          if (followUpItem.type === 'text') {
            finalResponse += followUpItem.text
          }
        }

        // Check if the follow-up response includes more tool calls
        if (
          finalFollowUpResponse.content.some((item) => item.type === 'tool_use')
        ) {
          console.log(
            'Claude is requesting additional tool calls in the follow-up, processing them'
          )

          // Process follow-up tool calls recursively - add to existing context and continue until done
          const recursiveResult = await processFollowUpToolCalls(
            context,
            finalFollowUpResponse,
            context.formattedTools,
            config.claudeModel
          )

          // Handle the recursive result structure
          finalResponse = recursiveResult.response || ''
          toolResponses = [
            ...toolResponses,
            ...(recursiveResult.toolResponses || []),
          ]
        } else {
          // Add final response to context if no more tool calls
          context.messages.push({
            role: 'assistant',
            content: finalFollowUpResponse.content,
          })
        }
      } else {
        // No tool use, just return text response
        finalResponse = response.content
          .filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join('')

        // Add Claude's response to conversation context
        context.messages.push({
          role: 'assistant',
          content: response.content,
        })
      }

      // Save updated conversation context
      conversationContexts.set(conversationId, context)

      // Check if Claude is asking for clarification or cannot answer
      const textResponse =
        typeof finalResponse === 'string' ? finalResponse : ''
      const needsClarification = textResponse.includes('#CLARIFY#')
      const noAnswer = textResponse.includes('#NOANSWER#')

      // Strip the markers from the response text
      let cleanResponse = textResponse
        .replace(/#CLARIFY#/g, '')
        .replace(/#NOANSWER#/g, '')
        .trim()

      // If lastResponseOnly is true, only return the last tool response
      let finalToolResponses = toolResponses
      if (config.lastResponseOnly && toolResponses.length > 0) {
        finalToolResponses = [toolResponses[toolResponses.length - 1]]
      }

      return {
        response: cleanResponse,
        conversationId,
        userId: context.userId,
        needsClarification,
        noAnswer,
        toolResponses: finalToolResponses,
      }
    } catch (error) {
      console.error('Error processing query:', error)

      // Reset cached clients on critical errors
      if (
        error.message.includes('stream is not readable') ||
        error.message.includes('network error') ||
        error.message.includes('connection closed')
      ) {
        // Close and reset clients
        for (const [serverName, client] of cachedClients.entries()) {
          try {
            client.close()
          } catch (closeError) {
            console.error(
              `Error closing client for "${serverName}":`,
              closeError
            )
          }
        }
        cachedClients.clear()
      }

      return {
        response: `Error: ${error.message}`,
        conversationId,
        userId: userId,
        error: true,
        toolResponses: [],
      }
    }
  })()

  // Race the processing against the timeout
  try {
    return await Promise.race([processingPromise, queryTimeout])
  } catch (error) {
    console.error('Query processing timed out or failed:', error)
    return {
      response: `Sorry, I couldn't process your query in time. ${error.message}`,
      conversationId,
      userId: userId,
      error: true,
      toolResponses: [],
    }
  }
}

// Helper function to recursively process follow-up tool calls
async function processFollowUpToolCalls(
  context,
  response,
  tools,
  model,
  depth = 0
) {
  // Prevent infinite recursion
  if (depth > 5) {
    return "I've reached the maximum number of follow-up steps. Please continue with a new query."
  }

  const toolUsages = response.content.filter((item) => item.type === 'tool_use')
  let toolResponses = []

  // Add assistant's response with tool calls to context
  context.messages.push({
    role: 'assistant',
    content: response.content,
  })

  // Process all tool calls in sequence
  for (const contentItem of toolUsages) {
    const toolCall = contentItem.input
    const toolName = contentItem.name

    function sanitizeServerName(name) {
      return name.replace(/[^a-zA-Z0-9_-]/g, '_')
    }

    console.log(
      `Follow-up tool call requested: ${toolName} with input:`,
      toolCall
    )

    // Determine which server the tool belongs to
    let toolResponse
    const CallToolResultSchema = z
      .object({
        content: z.array(z.any()),
      })
      .passthrough()

    // Create a reverse mapping from sanitized names to original names
    const serverNameMap = {}
    for (const name of Object.keys(config.mcpServers)) {
      const sanitized = sanitizeServerName(name)
      serverNameMap[sanitized] = name
    }

    // Check for the server prefix in the tool name
    const serverPrefix = toolName.split('_')[0]
    console.log(`Extracted server prefix: "${serverPrefix}"`)

    // For tools with multiple underscores in the prefix
    // we need to try different prefix combinations
    let originalServerName = null
    let originalToolName = null

    // Try to find the original server name by checking different possible prefixes
    const parts = toolName.split('_')

    for (let i = parts.length - 1; i > 0; i--) {
      const possiblePrefix = parts.slice(0, i).join('_')
      // console.log(`Trying possible prefix: "${possiblePrefix}"`)

      if (serverNameMap[possiblePrefix]) {
        originalServerName = serverNameMap[possiblePrefix]
        originalToolName = parts.slice(i).join('_')
        /* console.log(
          `Found match! Server: "${originalServerName}", Tool: "${originalToolName}"`
        ) */
        break
      }
    }

    // Get the appropriate client for this tool
    let client

    if (originalServerName && config.mcpServers[originalServerName]) {
      // This is a prefixed tool
      client = await createMCPClient(originalServerName)

      console.log(
        `Calling tool "${originalToolName}" on "${originalServerName}" server`
      )
    } else if (context.primaryServer) {
      // Fallback to primary server if no prefix match
      client = context.primaryServer.client
      originalToolName = toolName

      console.log(
        `No server prefix found for tool "${toolName}", using primary server "${context.primaryServer.name}"`
      )
    } else {
      throw new Error(`No server available for tool "${toolName}"`)
    }

    // Make the tool call through the appropriate MCP client
    try {
      toolResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: originalToolName,
            arguments: toolCall,
          },
        },
        CallToolResultSchema
      )

      console.log('Follow-up tool response:', toolResponse)

      // Store tool response
      toolResponses.push({
        tool: toolName,
        input: toolCall,
        response: toolResponse.content[0].text,
        server: originalServerName || context.primaryServer.name,
      })

      // Add user message with tool result to context
      context.messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: contentItem.id,
            content: toolResponse.content[0].text,
          },
        ],
      })
    } catch (error) {
      console.error(`Error calling follow-up tool ${originalToolName}:`, error)

      // Store error response
      toolResponses.push({
        tool: toolName,
        input: toolCall,
        response: `Error: ${error.message}`,
        server: originalServerName || context.primaryServer.name,
        error: true,
      })

      // Add error as tool result
      context.messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: contentItem.id,
            content: `Error calling tool: ${error.message}`,
          },
        ],
      })
    }
  }

  // After processing all tools, get another response
  const followUpResponse = await anthropic.messages.create({
    model: model,
    max_tokens: 2000,
    messages: context.messages,
    tools: tools, // Keep tools available for potential additional follow-up calls
  })

  // If there are more tool calls, process them recursively
  if (followUpResponse.content.some((item) => item.type === 'tool_use')) {
    console.log(
      `Additional tools requested in depth ${depth + 1}, processing recursively`
    )
    const recursiveResult = await processFollowUpToolCalls(
      context,
      followUpResponse,
      tools,
      model,
      depth + 1
    )

    // If the recursive result includes tool responses, merge them
    if (Array.isArray(recursiveResult.toolResponses)) {
      toolResponses = [...toolResponses, ...recursiveResult.toolResponses]
    }

    return {
      response: recursiveResult.response || '',
      toolResponses,
    }
  }

  // No more tool calls, add the final response to context
  context.messages.push({
    role: 'assistant',
    content: followUpResponse.content,
  })

  // Return both the text response and tool responses
  return {
    response: followUpResponse.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join(''),
    toolResponses,
  }
}

// Function to get all conversations for a specific user
function getUserConversations(userId) {
  if (!userId) return []

  const userConversations = []
  for (const [convId, context] of conversationContexts.entries()) {
    if (context.userId === userId) {
      userConversations.push({
        conversationId: convId,
        // Include first message and last message to help identify the conversation
        firstMessage:
          context.messages.length > 1 ? context.messages[1].content : '',
        lastMessage:
          context.messages.length > 0
            ? context.messages[context.messages.length - 1].content
            : '',
        messageCount: context.messages.length,
      })
    }
  }

  return userConversations
}

// Function to clear conversation context
function clearConversation(conversationId) {
  if (conversationContexts.has(conversationId)) {
    conversationContexts.delete(conversationId)
    return true
  }
  return false
}

// Function to clear all conversations for a user
function clearUserConversations(userId) {
  if (!userId) return false

  let deleted = 0
  for (const [convId, context] of conversationContexts.entries()) {
    if (context.userId === userId) {
      conversationContexts.delete(convId)
      deleted++
    }
  }

  return deleted > 0
}

// Get available servers and their actions
async function getServerActions() {
  const servers = {}

  // Define schema for validating tool list responses
  const ListToolsResultSchema = z.object({
    tools: z.array(z.any()),
  })

  for (const serverName of Object.keys(config.mcpServers)) {
    try {
      const client = await createMCPClient(serverName)
      const toolsResponse = await client.request(
        { method: 'tools/list' },
        ListToolsResultSchema
      )

      servers[serverName] = {
        name: serverName,
        actions: toolsResponse.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
        enabled: !config.mcpServers[serverName].disabled,
      }
    } catch (error) {
      console.error(`Failed to get actions for server ${serverName}:`, error)
      servers[serverName] = {
        name: serverName,
        error: error.message,
        enabled: !config.mcpServers[serverName].disabled,
      }
    }
  }

  return servers
}

// Function to preload and check all configured servers
async function preloadServers() {
  console.log('Preloading MCP servers...')

  // Define schema for validating tool list responses
  const ListToolsResultSchema = z.object({
    tools: z.array(z.any()),
  })

  // Get server discovery timeout from environment or use default
  const serverDiscoveryTimeout = parseInt(
    process.env.SERVER_DISCOVERY_TIMEOUT || '60000',
    10
  )

  // Track server status
  const serverStatus = {
    total: Object.keys(config.mcpServers).length,
    successful: 0,
    failed: 0,
    errors: {},
  }

  // Process each server in parallel with a timeout
  const serverPromises = Object.entries(config.mcpServers).map(
    async ([serverName, serverConfig]) => {
      try {
        // Set a timeout for each server
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('Server discovery timeout')),
            serverDiscoveryTimeout
          )
        })

        const discoveryPromise = (async () => {
          try {
            const client = await createMCPClient(serverName, 0, 1) // Only 1 retry for initial discovery
            const toolsResponse = await client.request(
              { method: 'tools/list' },
              ListToolsResultSchema
            )

            // Cache the tools for this server
            const sanitizedServerName = serverName.replace(
              /[^a-zA-Z0-9_-]/g,
              '_'
            )
            const prefixedTools = toolsResponse.tools.map((tool) => ({
              ...tool,
              name: `${sanitizedServerName}_${tool.name}`,
              originalName: tool.name,
              serverName: serverName,
            }))

            // Store tools and client in a global cache
            if (!global.serverCache) {
              global.serverCache = new Map()
            }
            global.serverCache.set(serverName, {
              tools: prefixedTools,
              client: client,
            })

            serverStatus.successful++
            console.log(`Successfully preloaded server: ${serverName}`)
            return { serverName, success: true }
          } catch (error) {
            serverStatus.failed++
            serverStatus.errors[serverName] = error.message
            console.error(
              `Failed to preload server ${serverName}:`,
              error.message
            )
            return { serverName, success: false, error: error.message }
          }
        })()

        // Race the discovery against timeout
        return await Promise.race([discoveryPromise, timeoutPromise])
      } catch (error) {
        serverStatus.failed++
        serverStatus.errors[serverName] = error.message
        console.error(`Failed to preload server ${serverName}:`, error.message)
        return { serverName, success: false, error: error.message }
      }
    }
  )

  // Wait for all servers to be processed
  const results = await Promise.allSettled(serverPromises)

  // Log summary
  console.log('\nServer preload summary:')
  console.log(`Total servers: ${serverStatus.total}`)
  console.log(`Successfully loaded: ${serverStatus.successful}`)
  console.log(`Failed to load: ${serverStatus.failed}`)

  if (serverStatus.failed > 0) {
    console.log('\nFailed servers:')
    Object.entries(serverStatus.errors).forEach(([server, error]) => {
      console.log(`- ${server}: ${error}`)
    })
  }

  return serverStatus
}

// Start preloading servers when this module is loaded
preloadServers().catch((error) => {
  console.error('Error during server preload:', error)
})

export {
  processQuery,
  getUserConversations,
  clearConversation,
  clearUserConversations,
  getServerActions,
}
