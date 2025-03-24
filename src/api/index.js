import express from 'express'
import {
  processQuery,
  clearConversation,
  getUserConversations,
  clearUserConversations,
} from '../mcp-client/client.js'

const router = express.Router()

// POST endpoint to process queries
router.post('/query', async (req, res) => {
  try {
    const {
      query,
      conversationId,
      userId,
      userEmail,
      queryTimeoutMs,
      llm_answer = false,
    } = req.body

    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required',
      })
    }

    // Call processQuery with the object parameter structure
    const response = await processQuery({
      query,
      conversationId,
      userId,
      userEmail,
      queryTimeoutMs,
      llm_answer,
    })

    res.json({
      query,
      answer: response.response || null,
      conversationId: response.conversationId,
      userId: response.userId,
      needsClarification: response.needsClarification,
      noAnswer: response.noAnswer,
      error: response.error,
      toolResponses: response.toolResponses,
    })
  } catch (error) {
    console.error('API error:', error)
    res.status(500).json({
      error: 'Failed to process query',
      message: error.message,
    })
  }
})

// GET endpoint to retrieve conversations for a user
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({
        error: 'User ID parameter is required',
      })
    }

    const conversations = getUserConversations(userId)

    res.json({
      userId,
      conversations,
    })
  } catch (error) {
    console.error('API error:', error)
    res.status(500).json({
      error: 'Failed to retrieve conversations',
      message: error.message,
    })
  }
})

// DELETE endpoint to clear a specific conversation
router.delete('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params

    if (!conversationId) {
      return res.status(400).json({
        error: 'Conversation ID parameter is required',
      })
    }

    const success = clearConversation(conversationId)

    if (success) {
      res.json({
        success: true,
        message: `Conversation ${conversationId} cleared successfully`,
      })
    } else {
      res.status(404).json({
        success: false,
        message: `Conversation ${conversationId} not found`,
      })
    }
  } catch (error) {
    console.error('API error:', error)
    res.status(500).json({
      error: 'Failed to clear conversation',
      message: error.message,
    })
  }
})

// DELETE endpoint to clear all conversations for a user
router.delete('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({
        error: 'User ID parameter is required',
      })
    }

    const success = clearUserConversations(userId)

    if (success) {
      res.json({
        success: true,
        message: `All conversations for user ${userId} cleared successfully`,
      })
    } else {
      res.json({
        success: false,
        message: `No conversations found for user ${userId}`,
      })
    }
  } catch (error) {
    console.error('API error:', error)
    res.status(500).json({
      error: 'Failed to clear user conversations',
      message: error.message,
    })
  }
})

export default router
