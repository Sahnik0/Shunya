import LLMService from './llmService.js';

class SandboxErrorFixerService {
    constructor(provider, apiKey, model) {
        this.llmService = new LLMService(provider, apiKey, model);
    }

    /**
     * Analyze sandbox errors and fix the problematic files
     */
    async fixSandboxErrors(error, files, fileStructure) {
        console.log('🔧 Sandbox Error Fixer analyzing error...');

        const prompt = this.createErrorFixPrompt(error, files, fileStructure);
        
        try {
            let response = '';
            for await (const chunk of this.llmService.streamCompletion(prompt)) {
                response += chunk;
            }

            // Parse the response to get fixed files
            const fixedFiles = this.parseFixedFiles(response);
            
            return {
                success: true,
                fixedFiles,
                explanation: this.extractExplanation(response)
            };
        } catch (err) {
            console.error('❌ Error fixing sandbox errors:', err);
            return {
                success: false,
                error: err.message
            };
        }
    }

    createErrorFixPrompt(error, files, fileStructure) {
        const errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
        
        // Detect if it's a dependency error
        const isDependencyError = errorMessage.includes('Cannot find package') || 
                                  errorMessage.includes('Cannot find module') ||
                                  errorMessage.includes('ERR_MODULE_NOT_FOUND');
        
        let specialInstructions = '';
        if (isDependencyError) {
            specialInstructions = `
DEPENDENCY ERROR DETECTED:
This is a missing package error. You MUST:
1. Identify the missing package from the error message
2. Either REMOVE the import/usage of that package, OR
3. Simplify the code to not need that package
4. For config files (vite.config.ts), either remove the file entirely or use only packages in dependencies

DO NOT suggest adding packages to dependencies - Sandpack has limited package support.
REMOVE or SIMPLIFY the code instead.`;
        }
        
        return [
            {
                role: 'system',
                content: `You are an expert code debugger specializing in fixing runtime and compile-time errors in web applications.

Your task is to analyze sandbox/runtime errors and fix the problematic code.

CRITICAL RULES:
1. Return ONLY valid code - no markdown, no explanations, no comments outside code
2. Never include control characters or invalid syntax
3. For CSS: Only valid CSS properties and values
4. For JS/TS: Only valid JavaScript/TypeScript syntax
5. Fix the exact file causing the error
6. Ensure all imports are correct
7. Remove any AI artifacts like <ctrl63>, <end>, etc.
8. For missing package errors: REMOVE the import and simplify the code
9. Sandpack runs in-browser and has limited package support

COMPLETE IMPLEMENTATION REQUIREMENTS - ABSOLUTE:
10. EVERY function MUST have a complete implementation (no empty bodies)
11. NEVER use placeholder comments (// TODO, // implement this, // rest of code here)
12. ALL edge cases MUST be handled (null checks, error handling, validation)
13. ALL async functions MUST have try-catch blocks
14. ALL user inputs MUST be validated
15. ALL array operations MUST check existence
16. ALL object property access MUST handle null/undefined
17. Write the ENTIRE function body with ALL logic

PROFESSIONAL UI REQUIREMENTS:
18. Create unique, catchy designs with professional polish
19. Use creative visual elements: glassmorphism, bold typography, interesting layouts
20. Choose striking color schemes: monochrome + vibrant accent, dark elegance, high contrast
21. Add engaging animations: micro-interactions, smooth reveals, hover transformations
22. NO generic templates, NO boring designs, NO childish elements
23. Inspire with: Apple (premium), Stripe (elegant), Framer (creative), Railway (bold)
23. NO animated emojis, NO cartoon graphics, NO childish elements
24. High contrast for readability

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "explanation": "Brief explanation of the fix",
  "files": {
    "filepath": "fixed content",
    "filepath2": "fixed content"
  }
}

EXAMPLE:
If CSS has syntax error on line 85, fix that specific line and return the entire corrected file.${specialInstructions}`
            },
            {
                role: 'user',
                content: `SANDBOX ERROR:
${errorMessage}

PROJECT TYPE: ${fileStructure.projectType}
PROJECT DESCRIPTION: ${fileStructure.description}

CURRENT FILES:
${files.map(f => `
FILE: ${f.path}
CONTENT:
${f.content}
---
`).join('\n')}

Analyze the error and return the fixed files in JSON format. Fix ONLY the files that have errors.`
            }
        ];
    }

    parseFixedFiles(response) {
        const fixedFiles = {};

        try {
            // Try to parse as JSON first
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.files) {
                    return parsed.files;
                }
            }
        } catch (e) {
            console.log('⚠️ Could not parse as JSON, trying alternative parsing...');
        }

        // Alternative: Look for file blocks
        const fileBlockRegex = /FILE:\s*([^\n]+)\n(?:CONTENT:\n)?([\s\S]*?)(?=FILE:|$)/g;
        let match;
        
        while ((match = fileBlockRegex.exec(response)) !== null) {
            const filePath = match[1].trim();
            let content = match[2].trim();
            
            // Clean up the content
            content = this.cleanContent(content);
            
            fixedFiles[filePath] = content;
        }

        return fixedFiles;
    }

    cleanContent(content) {
        // Remove markdown code blocks
        content = content.replace(/^```[\w]*\n/gm, '');
        content = content.replace(/\n```$/gm, '');
        content = content.replace(/```[\w]*$/gm, '');
        content = content.replace(/^```/gm, '');
        
        // Remove control character artifacts
        content = content.replace(/<ctrl\d+>/g, '');
        content = content.replace(/<end>/g, '');
        content = content.replace(/<start>/g, '');
        
        // Remove trailing separators
        content = content.replace(/^---+$/gm, '');
        
        return content.trim();
    }

    extractExplanation(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed.explanation || 'Fixed sandbox errors';
            }
        } catch (e) {
            // Ignore
        }
        return 'Fixed sandbox errors';
    }

    /**
     * Detect common error patterns
     */
    categorizeError(error) {
        const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
        
        if (errorStr.includes('CssSyntaxError')) {
            return {
                type: 'CSS_SYNTAX_ERROR',
                severity: 'high',
                file: this.extractFileFromError(errorStr)
            };
        } else if (errorStr.includes('SyntaxError')) {
            return {
                type: 'JS_SYNTAX_ERROR',
                severity: 'high',
                file: this.extractFileFromError(errorStr)
            };
        } else if (errorStr.includes('Module not found')) {
            return {
                type: 'MISSING_MODULE',
                severity: 'high',
                file: this.extractFileFromError(errorStr)
            };
        } else if (errorStr.includes('Cannot find module')) {
            return {
                type: 'MISSING_IMPORT',
                severity: 'medium',
                file: this.extractFileFromError(errorStr)
            };
        }
        
        return {
            type: 'UNKNOWN_ERROR',
            severity: 'medium',
            file: null
        };
    }

    extractFileFromError(errorStr) {
        const fileMatch = errorStr.match(/\/([^:]+\.(css|tsx?|jsx?|json))/);
        return fileMatch ? fileMatch[0] : null;
    }
}

export default SandboxErrorFixerService;
