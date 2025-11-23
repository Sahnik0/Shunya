import express from 'express';
import ContextualChatService from '../services/contextualChatService.js';
import VectorService from '../services/vectorService.js';

const router = express.Router();

/**
 * POST /api/chat/message
 * Send a message in context of the current project
 */
router.post('/message', async (req, res) => {
    try {
        const { projectId, userId, message, currentFiles, apiSettings } = req.body;

        if (!projectId || !userId || !message || !apiSettings) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }

        const { provider, apiKey, model } = apiSettings;
        const chatService = new ContextualChatService(provider, apiKey, model);

        console.log(`💬 Chat message for project ${projectId}:`, message.substring(0, 50) + '...');

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyzing your request...' })}\n\n`);

        // Process the message with full context
        const response = await chatService.processMessage(projectId, userId, message, currentFiles);

        res.write(`data: ${JSON.stringify({ type: 'response', data: response })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
        
        res.end();

    } catch (error) {
        console.error('Chat message error:', error);
        res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            message: error.message 
        })}\n\n`);
        res.end();
    }
});

/**
 * POST /api/chat/save-state
 * Save current project state for context
 */
router.post('/save-state', async (req, res) => {
    try {
        const { projectId, userId, files, description } = req.body;

        if (!projectId || !userId || !files) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }

        const vectorService = new VectorService();
        await vectorService.storeCodeSnapshot(projectId, userId, files, description || 'Project snapshot');
        await vectorService.close();

        res.json({
            success: true,
            message: 'Project state saved'
        });

    } catch (error) {
        console.error('Save state error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/chat/history/:projectId/:userId
 * Get chat history for a project
 */
router.get('/history/:projectId/:userId', async (req, res) => {
    try {
        const { projectId, userId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const vectorService = new VectorService();
        const history = await vectorService.getRecentHistory(projectId, userId, limit);
        await vectorService.close();

        res.json({
            success: true,
            history
        });

    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/chat/project-state/:projectId/:userId
 * Get latest project state
 */
router.get('/project-state/:projectId/:userId', async (req, res) => {
    try {
        const { projectId, userId } = req.params;

        const vectorService = new VectorService();
        const state = await vectorService.getLatestCodeSnapshot(projectId, userId);
        await vectorService.close();

        res.json({
            success: true,
            state
        });

    } catch (error) {
        console.error('Get project state error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
