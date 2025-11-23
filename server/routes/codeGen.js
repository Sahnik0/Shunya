import express from 'express';
import LLMService from '../services/llmService.js';
import CodeSupervisorService from '../services/codeSupervisorService.js';
import DiagnosticService from '../services/diagnosticService.js';
import AttributionService from '../services/attributionService.js';
import VectorService from '../services/vectorService.js';
import ReasoningService from '../services/reasoningService.js';
import ProductionValidatorService from '../services/productionValidatorService.js';
import { createPlanningPrompt, createCodeGenerationPrompt } from '../prompts/codeGeneration.js';

const router = express.Router();

// Generate project structure and code
router.post('/generate', async (req, res) => {
    try {
        const { userRequest, apiSettings } = req.body;
        
        if (!userRequest || !apiSettings) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { provider, apiKey, model } = apiSettings;
        
        if (!provider || !apiKey || !model) {
            return res.status(400).json({ error: 'Invalid API settings' });
        }

        // Set headers for Server-Sent Events (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const llmService = new LLMService(provider, apiKey, model);
        const reasoningService = new ReasoningService(provider, apiKey, model);

        // Send initial status
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyzing your request...' })}\n\n`);

        // Step 0: Deep Reasoning Phase - Think through the implementation systematically
        res.write(`data: ${JSON.stringify({ type: 'status', message: '🧠 Reasoning about the best approach...' })}\n\n`);
        
        let reasoning = null;
        let reasoningText = '';

        try {
            // Stream reasoning to client in real-time
            for await (const chunk of reasoningService.streamReasoning(userRequest, {})) {
                reasoningText += chunk;
                res.write(`data: ${JSON.stringify({ type: 'reasoning_chunk', content: chunk })}\n\n`);
            }

            // Parse and validate reasoning
            reasoning = reasoningService.parseReasoningResponse(reasoningText);
            const validation = reasoningService.validateReasoning(reasoning);
            const insights = reasoningService.extractInsights(reasoning);
            
            console.log('🧠 Reasoning Quality Score:', validation.qualityScore);
            console.log('✅ Reasoning Strengths:', validation.strengths.join(', '));
            if (validation.issues.length > 0) {
                console.log('⚠️ Reasoning Issues:', validation.issues.join(', '));
            }
            
            // Send complete reasoning with insights
            res.write(`data: ${JSON.stringify({ 
                type: 'reasoning_complete', 
                reasoning: reasoning,
                validation: validation,
                insights: insights
            })}\n\n`);
            
        } catch (reasoningError) {
            console.log('⚠️ Reasoning failed, continuing with standard planning...', reasoningError.message);
            res.write(`data: ${JSON.stringify({ 
                type: 'reasoning_error', 
                message: 'Advanced reasoning unavailable, using standard approach' 
            })}\n\n`);
        }

        // Step 1: Generate file structure
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Planning project structure...' })}\n\n`);
        
        const planningMessages = createPlanningPrompt(userRequest);
        let planningResponse = '';

        for await (const chunk of llmService.streamCompletion(planningMessages)) {
            planningResponse += chunk;
            // Send planning progress
            res.write(`data: ${JSON.stringify({ type: 'planning_chunk', content: chunk })}\n\n`);
        }

        // Parse the file structure
        let fileStructure;
        try {
            // Clean the response to extract JSON
            const jsonMatch = planningResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in planning response');
            }
            fileStructure = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.error('Failed to parse planning response:', planningResponse);
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to parse project structure' })}\n\n`);
            return res.end();
        }

        // Send complete file structure
        res.write(`data: ${JSON.stringify({ type: 'file_structure', data: fileStructure })}\n\n`);

        // Step 2: Generate code for each file
        // Filter out problematic config files that cause ESM/CommonJS conflicts
        const files = fileStructure.fileStructure
            .filter(item => item.type === 'file')
            .filter(item => {
                const path = item.path.toLowerCase();
                // Remove config files that cause module errors
                if (path.includes('postcss.config.js')) {
                    console.log('⚠️ Skipping postcss.config.js to avoid ESM/CommonJS conflict');
                    return false;
                }
                if (path.includes('tailwind.config.js')) {
                    console.log('⚠️ Skipping tailwind.config.js to avoid ESM/CommonJS conflict');
                    return false;
                }
                if (path.match(/\.config\.js$/)) {
                    console.log(`⚠️ Skipping ${path} to avoid potential ESM/CommonJS conflict`);
                    return false;
                }
                return true;
            });
        let generatedFiles = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            res.write(`data: ${JSON.stringify({ 
                type: 'status', 
                message: `Generating code for ${file.path} (${i + 1}/${files.length})...` 
            })}\n\n`);

            // Send file generation start event
            res.write(`data: ${JSON.stringify({ 
                type: 'file_generation_start', 
                file: file 
            })}\n\n`);

            const codeMessages = createCodeGenerationPrompt(
                userRequest,
                file.path,
                file.description,
                fileStructure.fileStructure,
                generatedFiles
            );

            let codeContent = '';

            for await (const chunk of llmService.streamCompletion(codeMessages)) {
                codeContent += chunk;
                // Stream code chunks
                res.write(`data: ${JSON.stringify({ 
                    type: 'code_chunk', 
                    file: file.path,
                    content: chunk 
                })}\n\n`);
            }

            // Clean markdown code blocks and trim
            let cleanedContent = codeContent.trim();
            cleanedContent = cleanedContent.replace(/^```[\w]*\n/gm, '');
            cleanedContent = cleanedContent.replace(/\n```$/gm, '');
            cleanedContent = cleanedContent.replace(/```/g, '');
            cleanedContent = cleanedContent.trim();

            // Send complete file
            generatedFiles.push({
                path: file.path,
                description: file.description,
                content: cleanedContent
            });

            res.write(`data: ${JSON.stringify({ 
                type: 'file_complete', 
                file: {
                    path: file.path,
                    content: cleanedContent
                }
            })}\n\n`);
        }

        // Step 3: Supervise and validate generated code
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Validating and fixing code...' })}\n\n`);
        
        const supervisor = new CodeSupervisorService(provider, apiKey, model);
        
        // Clean all generated files first
        generatedFiles = generatedFiles.map(f => ({
            ...f,
            content: supervisor.cleanCodeContent(f.content)
        }));
        
        const validation = await supervisor.validateAndFixCode(fileStructure, generatedFiles);

        // Update fileStructure with fixed dependencies
        if (validation.fileStructure) {
            fileStructure = validation.fileStructure;
        }

        // Apply fixes if any were found
        if (!validation.isValid && validation.fixedFiles && Object.keys(validation.fixedFiles).length > 0) {
            console.log('📝 Applying supervisor fixes...');
            for (const [filePath, fixedContent] of Object.entries(validation.fixedFiles)) {
                const fileIndex = generatedFiles.findIndex(f => f.path === filePath || f.path === `/${filePath}` || `/${f.path}` === filePath);
                if (fileIndex !== -1) {
                    generatedFiles[fileIndex].content = supervisor.cleanCodeContent(fixedContent);
                    res.write(`data: ${JSON.stringify({ 
                        type: 'file_fixed', 
                        file: filePath,
                        message: 'Fixed by supervisor AI'
                    })}\n\n`);
                } else {
                    // Add new fixed file
                    generatedFiles.push({
                        path: filePath,
                        description: `Fixed ${filePath}`,
                        content: supervisor.cleanCodeContent(fixedContent)
                    });
                    res.write(`data: ${JSON.stringify({ 
                        type: 'file_added', 
                        file: filePath,
                        message: 'Added by supervisor AI'
                    })}\n\n`);
                }
            }
        }

        // Ensure required files exist for React projects
        if (fileStructure.projectType.toLowerCase().includes('react')) {
            const defaultFiles = supervisor.createDefaultFiles(fileStructure.projectType, fileStructure.dependencies);
            
            for (const [filePath, content] of Object.entries(defaultFiles)) {
                const exists = generatedFiles.some(f => 
                    f.path === filePath || 
                    f.path === `/${filePath}` || 
                    `/${f.path}` === filePath ||
                    f.path.endsWith(filePath)
                );
                
                if (!exists) {
                    generatedFiles.push({
                        path: filePath,
                        description: `Default ${filePath}`,
                        content: content
                    });
                    res.write(`data: ${JSON.stringify({ 
                        type: 'file_added', 
                        file: filePath,
                        message: 'Added missing file'
                    })}\n\n`);
                }
            }
        }

        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Code ready!' })}\n\n`);

        // Step 4: Run diagnostic AI to analyze and fix sandbox issues
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Running diagnostic AI...' })}\n\n`);
        
        const diagnostic = new DiagnosticService(provider, apiKey, model);
        const diagnosis = await diagnostic.analyzeSandpackIssue(fileStructure, generatedFiles);
        
        res.write(`data: ${JSON.stringify({ 
            type: 'diagnostic_report', 
            diagnosis: diagnosis.diagnosis,
            recommendation: diagnosis.recommendation 
        })}\n\n`);

        // Apply diagnostic fixes
        generatedFiles = await diagnostic.fixBasedOnDiagnosis(diagnosis, generatedFiles);

        res.write(`data: ${JSON.stringify({ type: 'status', message: 'All diagnostics complete!' })}\n\n`);

        // Step 5: Production Validation - Check for ESM/CommonJS conflicts and other production issues
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Validating for production deployment...' })}\n\n`);
        
        const productionValidator = new ProductionValidatorService();
        const productionValidation = productionValidator.validateForProduction(fileStructure, generatedFiles);
        
        if (!productionValidation.isValid) {
            console.log('⚠️ Production validation found issues:', productionValidation.issues.length);
            
            res.write(`data: ${JSON.stringify({ 
                type: 'production_issues', 
                issues: productionValidation.issues.map(i => ({
                    severity: i.severity,
                    message: i.message,
                    file: i.file,
                    fix: i.fix
                }))
            })}\n\n`);
            
            // Apply automatic fixes
            if (productionValidation.fixes) {
                res.write(`data: ${JSON.stringify({ type: 'status', message: 'Applying production fixes...' })}\n\n`);
                
                const fixed = productionValidator.applyFixes(generatedFiles, fileStructure, productionValidation.fixes);
                generatedFiles = fixed.files;
                fileStructure = fixed.fileStructure;
                
                console.log('✅ Applied production fixes');
                res.write(`data: ${JSON.stringify({ 
                    type: 'production_fixed', 
                    message: 'Production issues automatically fixed' 
                })}\n\n`);
            }
        } else {
            console.log('✅ Production validation passed');
            res.write(`data: ${JSON.stringify({ 
                type: 'production_validated', 
                message: 'Code is production-ready' 
            })}\n\n`);
        }

        // Step 6: Add Shunya attribution
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Adding attribution...' })}\n\n`);
        
        const attribution = new AttributionService();
        generatedFiles = attribution.addAttribution(generatedFiles, fileStructure);
        
        // Add metadata file
        const metadataFile = attribution.createMetadataFile(fileStructure, userRequest);
        generatedFiles.push(metadataFile);
        
        console.log('✅ Added Shunya attribution to all files');

        // Step 7: Auto-save project state to vector database
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Saving project state...' })}\n\n`);
        
        try {
            const vectorService = new VectorService();
            
            // Generate unique project ID from request (use timestamp + hash of request)
            const projectId = `project_${Date.now()}`;
            const userId = req.body.userId || 'user-default'; // TODO: Get from auth
            
            // Save initial code snapshot
            await vectorService.storeCodeSnapshot(
                projectId,
                userId,
                generatedFiles,
                `Initial project: ${fileStructure.description}`
            );
            
            console.log('✅ Project state saved to vector database');
            res.write(`data: ${JSON.stringify({ 
                type: 'project_saved', 
                projectId,
                message: 'Project state saved for chat context' 
            })}\n\n`);
        } catch (vectorError) {
            console.error('⚠️ Failed to save project state:', vectorError.message);
            // Don't fail the entire request, just log it
        }

        // Send completion event
        res.write(`data: ${JSON.stringify({ 
            type: 'complete', 
            data: {
                projectType: fileStructure.projectType,
                description: fileStructure.description,
                dependencies: fileStructure.dependencies,
                devDependencies: fileStructure.devDependencies,
                files: generatedFiles
            }
        })}\n\n`);

        res.end();

    } catch (error) {
        console.error('Code generation error:', error);
        res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            message: error.message || 'An error occurred during code generation' 
        })}\n\n`);
        res.end();
    }
});

export default router;
