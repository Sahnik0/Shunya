import express from 'express';
import SmartSandboxErrorFixerService from '../services/smartSandboxErrorFixerService.js';

const router = express.Router();

/**
 * POST /api/sandbox/fix-error
 * Receives sandbox errors and returns fixed files with reasoning
 */
router.post('/fix-error', async (req, res) => {
    try {
        const { error, files, fileStructure, apiSettings, useSmartFix = true } = req.body;

        if (!error || !files || !fileStructure || !apiSettings) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }

        const { provider, apiKey, model } = apiSettings;
        
        // Use smart fixer with reasoning by default
        const fixer = new SmartSandboxErrorFixerService(provider, apiKey, model);

        console.log('🔧 Received sandbox error fix request (Smart Mode)');
        console.log('Error:', error.substring(0, 200) + '...');

        // Set up SSE for streaming reasoning updates
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendUpdate = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const result = await fixer.fixWithReasoning(
            error,
            files,
            fileStructure,
            sendUpdate
        );

        if (result.success) {
            console.log('✅ Fixed', Object.keys(result.fixedFiles).length, 'files');
            sendUpdate({
                type: 'complete',
                success: true,
                fixedFiles: result.fixedFiles,
                explanation: result.explanation,
                reasoning: result.reasoning,
                analysis: result.analysis,
                verification: result.verification
            });
        } else {
            console.error('❌ Failed to fix errors');
            sendUpdate({
                type: 'error',
                success: false,
                error: result.error,
                reasoning: result.reasoning
            });
        }

        res.end();

    } catch (error) {
        console.error('Sandbox error fix failed:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
