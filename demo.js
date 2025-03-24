#!/usr/bin/env node

import axios from 'axios'
import readline from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

// Create readline interface for user input
const rl = readline.createInterface({ input, output })

// Function to prompt user for input
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

// Function to simulate flow steps with timing
const simulateStep = async (stepName, delayMs = 300) => {
  return new Promise((resolve) => setTimeout(() => resolve(), delayMs))
}

// List configured MCP servers
function getConfiguredServers() {
  try {
    const configPath = path.resolve('./servers-config.json')
    const configData = fs.readFileSync(configPath, 'utf8')
    const config = JSON.parse(configData)

    return config.mcpServers ? Object.keys(config.mcpServers) : []
  } catch (error) {
    console.error('Error reading servers-config.json:', error.message)
    return []
  }
}

// Main demo function
async function runDemo() {
  console.log(chalk.bold.blue('MCP Client Demo'))
  console.log(chalk.gray('--------------------------------------'))
  console.log(
    chalk.yellow(
      'This demo demonstrates how to use external MCP servers with Claude.'
    )
  )

  // Display configured servers
  const servers = getConfiguredServers()
  if (servers.length > 0) {
    console.log(chalk.green('✓ Configured MCP servers:'))
    servers.forEach((server) => {
      console.log(chalk.green(`  • ${server}`))
    })
  } else {
    console.log(
      chalk.red(
        '✗ No MCP servers configured. Please add server configuration to servers-config.json.'
      )
    )
    rl.close()
    return
  }

  console.log(
    chalk.yellow(
      'Make sure your API server is running with `npm start` in another terminal.'
    )
  )
  console.log(chalk.gray('--------------------------------------\n'))

  try {
    // Check if server is running
    console.log(chalk.cyan('Checking if the API server is running...'))
    try {
      const response = await axios.get('http://localhost:3000/')
      console.log(chalk.green('✓ API server is running!'))
      console.log(
        chalk.green(
          `✓ Available servers: ${
            response.data.availableServers.join(', ') || 'None'
          }`
        )
      )
    } catch (error) {
      console.log(
        chalk.red(
          '✗ API server is not running. Please start it with `npm start` in another terminal.'
        )
      )
      rl.close()
      return
    }

    while (true) {
      console.log(chalk.gray('\n--------------------------------------'))

      // Get user query
      const query = await askQuestion(
        chalk.bold.white('Enter your query (or type "exit" to quit): ')
      )

      if (query.toLowerCase() === 'exit') {
        break
      }

      // Ask if user wants LLM answer
      const useLLMAnswer = await askQuestion(
        chalk.bold.white('Generate LLM answer? (y/n, default: y): ')
      )
      const llm_answer = useLLMAnswer.toLowerCase() !== 'n'

      console.log(chalk.gray('--------------------------------------'))
      console.log(chalk.magenta('⚙️ Processing query...'))

      try {
        // Simulate the flow with timing
        console.log(chalk.cyan('1. → API Server receives query'))
        await simulateStep()

        console.log(
          chalk.cyan('2. → MCP Client connects to configured servers')
        )
        await simulateStep()

        console.log(
          chalk.cyan('3. → All server tools are discovered and collected')
        )
        await simulateStep()

        console.log(chalk.cyan('4. → Claude analyzes the query'))
        await simulateStep()

        // Determine if weather-related query
        const isWeatherQuery =
          query.toLowerCase().includes('weather') ||
          query.toLowerCase().includes('temperature') ||
          query.toLowerCase().includes('forecast') ||
          query.toLowerCase().includes('alerts')

        if (isWeatherQuery && servers.includes('weather')) {
          console.log(
            chalk.cyan('5. → Claude identifies need for weather tool')
          )
          await simulateStep()

          console.log(
            chalk.cyan('6. → MCP Client calls the weather server tool')
          )
          await simulateStep()

          console.log(
            chalk.cyan('7. → Claude generates response with tool results')
          )
          await simulateStep()
        } else {
          console.log(
            chalk.cyan('5. → Claude decides which tool to use (if any)')
          )
          await simulateStep(800)
        }

        // Send query to API
        console.log(chalk.cyan('8. → API Server returns response to User'))
        const startTime = Date.now()
        const response = await axios.post('http://localhost:3000/api/query', {
          query,
          llm_answer,
        })
        const endTime = Date.now()

        // Display timing information
        console.log(
          chalk.green(`✓ Response received in ${endTime - startTime}ms`)
        )

        // Display formatted response
        console.log(chalk.gray('--------------------------------------'))
        console.log(chalk.bold.white('Response:'))

        // Handle different response types
        if (response.data.error) {
          console.log(chalk.red('Error:', response.data.answer))
        } else if (response.data.needsClarification) {
          console.log(
            chalk.yellow('Clarification needed:', response.data.answer)
          )
        } else if (response.data.noAnswer) {
          console.log(
            chalk.yellow('No answer available:', response.data.answer)
          )
        } else if (llm_answer && response.data.answer) {
          // Only show LLM answer if llm_answer is true and we have an answer
          console.log(chalk.white(response.data.answer))
        } else if (!llm_answer) {
          // When llm_answer is false, show a message indicating we're only showing tool responses
          console.log(
            chalk.yellow('LLM answer disabled - showing tool responses only')
          )
        }

        // Display tool responses if any
        if (
          response.data.toolResponses &&
          response.data.toolResponses.length > 0
        ) {
          console.log(chalk.gray('\n--------------------------------------'))
          console.log(chalk.bold.white('Tool Responses:'))
          response.data.toolResponses.forEach((toolResponse, index) => {
            console.log(chalk.cyan(`\nTool ${index + 1}: ${toolResponse.tool}`))
            console.log(
              chalk.gray('Input:'),
              JSON.stringify(toolResponse.input, null, 2)
            )
            if (toolResponse.error) {
              console.log(chalk.red('Error:'), toolResponse.response)
            } else {
              console.log(chalk.green('Response:'), toolResponse.response)
            }
          })
        }
      } catch (error) {
        console.log(chalk.red('Error processing query:'), error.message)
        if (error.response) {
          console.log(chalk.red('Server response:'), error.response.data)
        }
      }
    }
  } catch (error) {
    console.log(chalk.red('An error occurred:'), error.message)
  } finally {
    rl.close()
  }
}

// Run the demo
runDemo().then(() => {
  console.log(chalk.bold.blue('Thank you for trying the MCP Client demo!'))
  process.exit(0)
})
