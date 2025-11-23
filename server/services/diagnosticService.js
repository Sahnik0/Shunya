import LLMService from './llmService.js';

class DiagnosticService {
    constructor(provider, apiKey, model) {
        this.llmService = new LLMService(provider, apiKey, model);
    }

    async analyzeSandpackIssue(fileStructure, generatedFiles) {
        const diagnosticPrompt = `You are a Sandpack and React expert diagnostic AI. Analyze why the sandbox is showing blank/empty.

GENERATED PROJECT:
${JSON.stringify(fileStructure, null, 2)}

GENERATED FILES (${generatedFiles.length} files):
${generatedFiles.map(f => `- ${f.path} (${f.content.length} chars)`).join('\n')}

FILE CONTENTS:
${generatedFiles.map(f => `\n=== ${f.path} ===\n${f.content.substring(0, 500)}...\n`).join('\n')}

ANALYZE AND DIAGNOSE:
1. Are all required files present? (index.html, entry point, App component)
2. Are the file paths correct for Sandpack? (should start with /)
3. Is the entry point using correct React 18 syntax?
4. Are there any syntax errors in the code?
5. Are imports/exports correct?
6. Is the HTML file pointing to the right entry?

RETURN A JSON OBJECT:
{
  "diagnosis": {
    "missingFiles": ["list of missing required files"],
    "pathIssues": ["files with incorrect paths"],
    "syntaxErrors": ["files with syntax errors"],
    "importIssues": ["files with import problems"],
    "entryPointIssue": "description if entry point is wrong",
    "rootCause": "The main reason sandbox is blank"
  },
  "fixes": {
    "filePath": "corrected or new content"
  },
  "recommendation": "Overall recommendation"
}`;

        const messages = [
            { role: 'system', content: 'You are a debugging AI expert in React and Sandpack. Provide detailed diagnostic analysis.' },
            { role: 'user', content: diagnosticPrompt }
        ];

        let response = '';
        for await (const chunk of this.llmService.streamCompletion(messages)) {
            response += chunk;
        }

        // Extract JSON
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse diagnostic response:', e);
        }

        return {
            diagnosis: {
                rootCause: 'Could not analyze - please check manually',
                missingFiles: [],
                pathIssues: [],
                syntaxErrors: [],
                importIssues: []
            },
            fixes: {},
            recommendation: response
        };
    }

    async fixBasedOnDiagnosis(diagnosis, generatedFiles) {
        console.log('\n🔍 DIAGNOSTIC REPORT:');
        console.log('Root Cause:', diagnosis.diagnosis.rootCause);
        console.log('Missing Files:', diagnosis.diagnosis.missingFiles);
        console.log('Path Issues:', diagnosis.diagnosis.pathIssues);
        console.log('Syntax Errors:', diagnosis.diagnosis.syntaxErrors);
        console.log('Import Issues:', diagnosis.diagnosis.importIssues);
        console.log('\n💡 Recommendation:', diagnosis.recommendation);

        // Apply fixes
        const fixedFiles = [...generatedFiles];

        if (diagnosis.fixes && Object.keys(diagnosis.fixes).length > 0) {
            console.log('\n🔧 Applying fixes from diagnostic AI...');
            
            for (const [filePath, content] of Object.entries(diagnosis.fixes)) {
                const existingIndex = fixedFiles.findIndex(f => 
                    f.path === filePath || `/${f.path}` === filePath || f.path === `/${filePath}`
                );

                if (existingIndex !== -1) {
                    fixedFiles[existingIndex].content = content;
                    console.log(`✅ Fixed: ${filePath}`);
                } else {
                    fixedFiles.push({
                        path: filePath.startsWith('/') ? filePath : `/${filePath}`,
                        content: content,
                        description: 'Added by diagnostic AI'
                    });
                    console.log(`➕ Added: ${filePath}`);
                }
            }
        }

        return fixedFiles;
    }
}

export default DiagnosticService;
