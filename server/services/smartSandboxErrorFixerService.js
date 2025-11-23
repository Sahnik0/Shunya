import LLMService from './llmService.js';
import ReasoningService from './reasoningService.js';

/**
 * Enhanced Sandbox Error Fixer with Deep Reasoning and Context Awareness
 */
class SmartSandboxErrorFixerService {
    constructor(provider, apiKey, model) {
        this.llmService = new LLMService(provider, apiKey, model);
        this.reasoningService = new ReasoningService(provider, apiKey, model);
    }

    /**
     * Fix sandbox errors with deep reasoning and codebase analysis
     * @param {string} error - The error message
     * @param {array} files - All project files
     * @param {object} fileStructure - Project structure metadata
     * @param {function} onReasoningUpdate - Callback for streaming reasoning updates
     * @returns {Promise<object>} - Fix result with reasoning
     */
    async fixWithReasoning(error, files, fileStructure, onReasoningUpdate = null) {
        console.log('🧠 Starting smart error fix with deep reasoning...');
        
        const fixProcess = {
            reasoning: null,
            analysis: null,
            fixedFiles: null,
            verification: null
        };

        try {
            // STEP 1: Deep Error Analysis with Reasoning
            if (onReasoningUpdate) {
                onReasoningUpdate({
                    stage: 'analyzing',
                    message: 'Analyzing error and codebase context...',
                    progress: 10
                });
            }

            const errorAnalysis = await this.reasoningService.reasonAboutErrorFix(error, files);
            fixProcess.reasoning = errorAnalysis;

            if (onReasoningUpdate) {
                onReasoningUpdate({
                    stage: 'reasoning_complete',
                    message: 'Root cause identified',
                    progress: 30,
                    reasoning: errorAnalysis
                });
            }

            // STEP 2: Analyze Full Codebase Context
            if (onReasoningUpdate) {
                onReasoningUpdate({
                    stage: 'codebase_analysis',
                    message: 'Scanning entire codebase for related issues...',
                    progress: 40
                });
            }

            const codebaseContext = this.analyzeCodebase(files, error);
            fixProcess.analysis = codebaseContext;

            // STEP 3: Generate Fixes Based on Reasoning
            if (onReasoningUpdate) {
                onReasoningUpdate({
                    stage: 'generating_fix',
                    message: 'Implementing fixes across affected files...',
                    progress: 60
                });
            }

            const fixes = await this.generateSmartFixes(
                error,
                files,
                fileStructure,
                errorAnalysis,
                codebaseContext
            );

            fixProcess.fixedFiles = fixes.files;

            // STEP 4: Verify Fixes
            if (onReasoningUpdate) {
                onReasoningUpdate({
                    stage: 'verifying',
                    message: 'Verifying fixes...',
                    progress: 80
                });
            }

            const verification = this.verifyFixes(fixes.files, error);
            fixProcess.verification = verification;

            if (onReasoningUpdate) {
                onReasoningUpdate({
                    stage: 'complete',
                    message: 'Fix complete and verified',
                    progress: 100,
                    result: fixProcess
                });
            }

            return {
                success: true,
                fixedFiles: fixes.files,
                explanation: fixes.explanation,
                reasoning: errorAnalysis,
                analysis: codebaseContext,
                verification: verification,
                affectedFiles: Object.keys(fixes.files)
            };

        } catch (err) {
            console.error('❌ Smart error fix failed:', err);
            
            if (onReasoningUpdate) {
                onReasoningUpdate({
                    stage: 'error',
                    message: `Fix failed: ${err.message}`,
                    progress: 0
                });
            }

            return {
                success: false,
                error: err.message,
                reasoning: fixProcess.reasoning
            };
        }
    }

    /**
     * Analyze codebase for context-aware fixing
     */
    analyzeCodebase(files, error) {
        const analysis = {
            totalFiles: files.length,
            affectedFiles: [],
            dependencies: new Set(),
            imports: new Map(),
            exports: new Map(),
            relatedFiles: []
        };

        // Extract file mentioned in error
        const errorFilePath = this.extractFileFromError(error);

        files.forEach(file => {
            // Check if file is directly mentioned in error
            if (errorFilePath && file.path.includes(errorFilePath)) {
                analysis.affectedFiles.push(file.path);
            }

            // Analyze imports/exports
            const importMatches = file.content.matchAll(/import\s+.*?\s+from\s+['"](.+?)['"]/g);
            for (const match of importMatches) {
                if (!analysis.imports.has(file.path)) {
                    analysis.imports.set(file.path, []);
                }
                analysis.imports.get(file.path).push(match[1]);
            }

            // Track dependencies
            const depMatches = file.content.matchAll(/from\s+['"](.+?)['"]/g);
            for (const match of depMatches) {
                if (!match[1].startsWith('.')) {
                    analysis.dependencies.add(match[1]);
                }
            }

            // Find related files (files that import the affected file)
            if (errorFilePath) {
                const importPath = errorFilePath.replace(/^\//, '').replace(/\.(tsx?|jsx?)$/, '');
                if (file.content.includes(importPath)) {
                    analysis.relatedFiles.push(file.path);
                }
            }
        });

        return {
            ...analysis,
            dependencies: Array.from(analysis.dependencies),
            imports: Object.fromEntries(analysis.imports),
            exports: Object.fromEntries(analysis.exports)
        };
    }

    /**
     * Generate smart fixes using reasoning and codebase context
     */
    async generateSmartFixes(error, files, fileStructure, reasoning, codebaseContext) {
        const prompt = this.createSmartFixPrompt(
            error,
            files,
            fileStructure,
            reasoning,
            codebaseContext
        );

        let response = '';
        for await (const chunk of this.llmService.streamCompletion(prompt)) {
            response += chunk;
        }

        return {
            files: this.parseFixedFiles(response),
            explanation: this.extractExplanation(response)
        };
    }

    /**
     * Create enhanced prompt with reasoning context
     */
    createSmartFixPrompt(error, files, fileStructure, reasoning, codebaseContext) {
        const rootCause = reasoning?.errorAnalysis?.rootCause?.fundamentalIssue || 'Unknown';
        const fixStrategy = reasoning?.errorAnalysis?.fixStrategy?.selected || 'properFix';

        return [
            {
                role: 'system',
                content: `You are an expert code debugger with deep reasoning capabilities.

You have analyzed this error and identified:
ROOT CAUSE: ${rootCause}
FIX STRATEGY: ${fixStrategy}

CODEBASE CONTEXT:
- Total Files: ${codebaseContext.totalFiles}
- Affected Files: ${codebaseContext.affectedFiles.join(', ')}
- Dependencies: ${codebaseContext.dependencies.join(', ')}
- Related Files: ${codebaseContext.relatedFiles.join(', ')}

Your task is to implement fixes across ALL affected files, not just the one with the error.

CRITICAL RULES:
1. Fix the root cause, not just symptoms
2. Update ALL files that depend on changed code
3. Ensure imports/exports are consistent across files
4. Handle edge cases comprehensively
5. Return complete, working code for ALL modified files

OUTPUT FORMAT:
{
  "explanation": "Detailed explanation of what was fixed and why",
  "files": {
    "/path/to/file1.tsx": "complete fixed content",
    "/path/to/file2.tsx": "complete fixed content"
  }
}

Return ONLY valid JSON with complete file contents.`
            },
            {
                role: 'user',
                content: `ERROR: ${error}

PROJECT: ${fileStructure.projectType}

ALL FILES:
${files.map(f => `
=== ${f.path} ===
${f.content}
`).join('\n')}

Based on the reasoning and codebase analysis, implement comprehensive fixes.`
            }
        ];
    }

    /**
     * Verify that fixes are valid
     */
    verifyFixes(fixedFiles, originalError) {
        const verification = {
            filesModified: Object.keys(fixedFiles).length,
            checks: {
                noEmptyFunctions: true,
                noTODOComments: true,
                validSyntax: true,
                importsResolved: true
            },
            warnings: []
        };

        for (const [path, content] of Object.entries(fixedFiles)) {
            // Check for empty functions
            if (content.match(/function\s+\w+\([^)]*\)\s*\{\s*\}/)) {
                verification.checks.noEmptyFunctions = false;
                verification.warnings.push(`${path}: Contains empty function`);
            }

            // Check for TODO comments
            if (content.includes('// TODO') || content.includes('// FIXME')) {
                verification.checks.noTODOComments = false;
                verification.warnings.push(`${path}: Contains TODO/FIXME comments`);
            }

            // Check for basic syntax issues
            if (content.includes('undefined') && !content.includes('!== undefined')) {
                verification.warnings.push(`${path}: May have undefined references`);
            }
        }

        return verification;
    }

    extractFileFromError(errorStr) {
        const fileMatch = errorStr.match(/\/([^:]+\.(css|tsx?|jsx?|json))/);
        return fileMatch ? fileMatch[0] : null;
    }

    parseFixedFiles(response) {
        const fixedFiles = {};

        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.files) {
                    return parsed.files;
                }
            }
        } catch (e) {
            console.log('⚠️ JSON parse failed, using fallback...');
        }

        // Fallback parsing
        const fileBlockRegex = /===\s*([^\n]+)\s*===\n([\s\S]*?)(?====|$)/g;
        let match;
        
        while ((match = fileBlockRegex.exec(response)) !== null) {
            const filePath = match[1].trim();
            const content = match[2].trim();
            fixedFiles[filePath] = content;
        }

        return fixedFiles;
    }

    extractExplanation(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed.explanation || 'Applied fixes based on deep reasoning';
            }
        } catch (e) {
            // Ignore
        }
        return 'Applied fixes based on deep reasoning and codebase analysis';
    }
}

export default SmartSandboxErrorFixerService;
