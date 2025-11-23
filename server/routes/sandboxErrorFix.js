import express from 'express';
import SandboxErrorFixerService from '../services/sandboxErrorFixerService.js';

const router = express.Router();

/**
 * POST /api/sandbox/fix-error
 * Receives sandbox errors and returns fixed files
 */
router.post('/fix-error', async (req, res) => {
    try {
        const { error, files, fileStructure, apiSettings } = req.body;

        if (!error || !files || !fileStructure || !apiSettings) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }

        const { provider, apiKey, model } = apiSettings;
        const fixer = new SandboxErrorFixerService(provider, apiKey, model);

        console.log('🔧 Received sandbox error fix request');
        console.log('Error:', error.substring(0, 200) + '...');

        const result = await fixer.fixSandboxErrors(error, files, fileStructure);

        if (result.success) {
            console.log('✅ Fixed', Object.keys(result.fixedFiles).length, 'files');
            return res.json({
                success: true,
                fixedFiles: result.fixedFiles,
                explanation: result.explanation
            });
        } else {
            console.error('❌ Failed to fix errors');
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Sandbox error fix failed:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
