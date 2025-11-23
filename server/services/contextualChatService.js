import LLMService from './llmService.js';
import VectorService from './vectorService.js';
import ReasoningService from './reasoningService.js';
import { AUTONOMOUS_AGENT_PROMPT, CODE_EDIT_TASK_PROMPT } from '../prompts/autonomousAgent.js';

class ContextualChatService {
    constructor(provider, apiKey, model) {
        this.llmService = new LLMService(provider, apiKey, model);
        this.vectorService = new VectorService();
        this.reasoningService = new ReasoningService(provider, apiKey, model);
    }

    /**
     * Process chat message with full context awareness
     */
    async processMessage(projectId, userId, message, currentFiles = null) {
        try {
            console.log('💬 Processing contextual chat message...');

            // Store the user message
            await this.vectorService.storeChatMessage(projectId, userId, message, 'user');

            // Build context from history and vector search
            const context = await this.vectorService.buildContextForAI(projectId, userId, message);

            // Determine intent
            const intent = this.analyzeIntent(message);
            console.log('🎯 Detected intent:', intent.type);

            // Generate response based on intent
            let response;
            if (intent.type === 'code_edit' || intent.type === 'fix_issue') {
                response = await this.handleCodeEdit(message, context, currentFiles, intent);
            } else if (intent.type === 'question') {
                response = await this.handleQuestion(message, context);
            } else {
                response = await this.handleGeneralChat(message, context);
            }

            // Store assistant response
            await this.vectorService.storeChatMessage(
                projectId, 
                userId, 
                typeof response === 'string' ? response : JSON.stringify(response),
                'assistant'
            );

            return response;

        } catch (error) {
            console.error('❌ Contextual chat failed:', error);
            throw error;
        }
    }

    /**
     * Analyze user intent from message
     */
    analyzeIntent(message) {
        const lowerMessage = message.toLowerCase();

        // Code editing keywords - expanded from Cursor Agent patterns
        const editKeywords = [
            'fix', 'change', 'update', 'modify', 'add', 'remove', 'delete', 
            'refactor', 'improve', 'optimize', 'create', 'implement', 'build',
            'rename', 'move', 'replace', 'insert', 'cleanup', 'enhance',
            'adjust', 'tweak', 'correct', 'repair', 'revise', 'make'
        ];
        const hasEditKeyword = editKeywords.some(keyword => lowerMessage.includes(keyword));

        // Question keywords
        const questionKeywords = [
            'what', 'how', 'why', 'when', 'where', 'which', 'who',
            'can you', 'could you', 'would you', 'should i', 
            'explain', 'tell me', 'show me', 'describe', 'clarify'
        ];
        const hasQuestionKeyword = questionKeywords.some(keyword => lowerMessage.includes(keyword));

        // Component/file references - expanded patterns
        const hasFileReference = lowerMessage.match(/\.(tsx?|jsx?|css|html|json|md|py|java|go|rs)/i) || 
                                lowerMessage.includes('component') ||
                                lowerMessage.includes('file') ||
                                lowerMessage.includes('function') ||
                                lowerMessage.includes('class') ||
                                lowerMessage.includes('module') ||
                                lowerMessage.includes('service');

        // Feature/UI keywords indicate code editing
        const featureKeywords = [
            'button', 'form', 'modal', 'page', 'navbar', 'footer', 'header',
            'theme', 'style', 'layout', 'design', 'ui', 'interface',
            'dark mode', 'light mode', 'responsive', 'mobile'
        ];
        const hasFeatureKeyword = featureKeywords.some(keyword => lowerMessage.includes(keyword));

        // Determine intent with higher confidence
        if (hasEditKeyword || hasFeatureKeyword) {
            if (hasFileReference) {
                return {
                    type: 'code_edit',
                    confidence: 0.95,
                    keywords: [...editKeywords.filter(k => lowerMessage.includes(k)), ...featureKeywords.filter(k => lowerMessage.includes(k))]
                };
            } else {
                return {
                    type: 'fix_issue',
                    confidence: 0.85,
                    keywords: editKeywords.filter(k => lowerMessage.includes(k))
                };
            }
        } else if (hasQuestionKeyword && !hasEditKeyword) {
            return {
                type: 'question',
                confidence: 0.8,
                keywords: questionKeywords.filter(k => lowerMessage.includes(k))
            };
        } else {
            // Default to code_edit for ambiguous cases
            return {
                type: 'code_edit',
                confidence: 0.6,
                keywords: []
            };
        }
    }

    /**
     * Handle code editing requests with reasoning
     */
    async handleCodeEdit(message, context, currentFiles, intent) {
        // Check if this is an error fixing request
        const isErrorFix = this.isErrorFixing(message, intent);
        
        if (isErrorFix) {
            console.log('🔍 Detected error fixing intent, using reasoning service...');
            return await this.handleCodeEditWithReasoning(message, context, currentFiles, intent);
        }
        
        // Standard code editing without deep reasoning
        const prompt = this.createCodeEditPrompt(message, context, currentFiles, intent);

        let response = '';
        for await (const chunk of this.llmService.streamCompletion(prompt)) {
            response += chunk;
        }

        // Parse the response to extract file changes
        return this.parseCodeEditResponse(response);
    }

    /**
     * Handle code editing with deep reasoning (for complex changes and error fixes)
     */
    async handleCodeEditWithReasoning(message, context, currentFiles, intent) {
        try {
            console.log('🧠 Starting reasoning-based code editing...');
            
            // Step 1: Reason about the problem/error
            const reasoning = await this.reasoningService.reasonAboutImplementation(message, {
                existingFiles: currentFiles,
                recentHistory: context.recentHistory,
                type: this.isErrorFixing(message, intent) ? 'error_fixing' : 'implementation'
            });
            
            console.log('✅ Reasoning complete, confidence:', reasoning.confidence?.overall || 'N/A');
            
            // Step 2: Use reasoning insights to create better prompt
            const enhancedPrompt = this.createEnhancedCodeEditPrompt(
                message, 
                context, 
                currentFiles, 
                intent,
                reasoning
            );
            
            // Step 3: Generate code changes based on reasoning
            let response = '';
            for await (const chunk of this.llmService.streamCompletion(enhancedPrompt)) {
                response += chunk;
            }
            
            // Step 4: Parse and attach reasoning to response
            const result = this.parseCodeEditResponse(response);
            
            // Attach reasoning insights for client
            if (result.type === 'code_edit') {
                result.reasoning = {
                    analysis: reasoning.thinking || reasoning.errorAnalysis,
                    confidence: reasoning.confidence,
                    insights: this.reasoningService.extractInsights(reasoning)
                };
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Reasoning-based editing failed, falling back to standard:', error);
            
            // Fallback to standard code editing
            const prompt = this.createCodeEditPrompt(message, context, currentFiles, intent);
            let response = '';
            for await (const chunk of this.llmService.streamCompletion(prompt)) {
                response += chunk;
            }
            return this.parseCodeEditResponse(response);
        }
    }

    /**
     * Check if message is about error fixing
     */
    isErrorFixing(message, intent) {
        const lowerMessage = message.toLowerCase();
        
        const errorKeywords = [
            'error', 'bug', 'fix', 'broken', 'not working', 'crash', 'failed',
            'issue', 'problem', 'wrong', 'incorrect', 'unexpected', 'debug'
        ];
        
        const hasErrorKeyword = errorKeywords.some(keyword => lowerMessage.includes(keyword));
        const isFixIntent = intent.type === 'fix_issue' || intent.type === 'code_edit';
        
        return hasErrorKeyword && isFixIntent;
    }

    /**
     * Create enhanced prompt with reasoning insights
     */
    createEnhancedCodeEditPrompt(message, context, currentFiles, intent, reasoning) {
        const prompt = this.createCodeEditPrompt(message, context, currentFiles, intent);
        
        // Inject reasoning insights into the user message
        const insights = this.reasoningService.extractInsights(reasoning);
        
        let reasoningContext = '\n\n## AI REASONING INSIGHTS:\n\n';
        
        if (insights.keyDecisions && insights.keyDecisions.length > 0) {
            reasoningContext += '### Key Decisions:\n';
            insights.keyDecisions.forEach(decision => {
                reasoningContext += `- **${decision.type}**: ${decision.decision}\n`;
                if (decision.reasoning) {
                    reasoningContext += `  Reasoning: ${decision.reasoning}\n`;
                }
            });
        }
        
        if (insights.potentialRisks && insights.potentialRisks.length > 0) {
            reasoningContext += '\n### Potential Risks to Address:\n';
            insights.potentialRisks.forEach(risk => {
                reasoningContext += `- ${risk}\n`;
            });
        }
        
        if (insights.recommendations && insights.recommendations.length > 0) {
            reasoningContext += '\n### Implementation Recommendations:\n';
            insights.recommendations.forEach(rec => {
                reasoningContext += `- ${rec.description}\n`;
            });
        }
        
        reasoningContext += `\n### Confidence Level: ${(insights.confidence * 100).toFixed(0)}%\n`;
        reasoningContext += '\nUse these insights to guide your implementation. Follow the recommended approach and address all identified risks.\n';
        
        // Append to the user message
        if (prompt.length > 1) {
            prompt[1].content += reasoningContext;
        }
        
        return prompt;
    }

    /**
     * Create prompt for code editing
     */
    createCodeEditPrompt(message, context, currentFiles, intent) {
        // Build comprehensive context with FULL file contents
        let filesContext = '';
        if (currentFiles && currentFiles.length > 0) {
            filesContext = '## CURRENT PROJECT FILES:\n\n';
            currentFiles.forEach(file => {
                filesContext += `### File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
            });
        }

        // Add similar past contexts from vector search
        let pastContext = '';
        if (context.similarContext && context.similarContext.length > 0) {
            pastContext = '## RELEVANT PAST CONVERSATIONS:\n';
            context.similarContext.slice(0, 3).forEach((ctx, idx) => {
                if (ctx.type === 'chat_message') {
                    pastContext += `- ${ctx.role}: ${ctx.content}\n`;
                } else if (ctx.type === 'code_snapshot') {
                    pastContext += `- Previous version: ${ctx.description}\n`;
                }
            });
            pastContext += '\n';
        }

        // Add recent chat history
        let historyContext = '';
        if (context.recentHistory && context.recentHistory.length > 0) {
            historyContext = '## RECENT CONVERSATION HISTORY:\n';
            context.recentHistory.slice(-10).forEach(msg => {
                historyContext += `${msg.role}: ${msg.content}\n`;
            });
            historyContext += '\n';
        }

        return [
            {
                role: 'system',
                content: AUTONOMOUS_AGENT_PROMPT
            },
            {
                role: 'user',
                content: CODE_EDIT_TASK_PROMPT(message, intent, filesContext, historyContext, pastContext)
            }
        ];
    }

    /**
     * Parse AI response for code edits with enhanced validation
     */
    parseCodeEditResponse(response) {
        try {
            // Remove markdown code blocks if present
            let cleanedResponse = response.trim();
            
            // Remove ```json and ``` markers
            cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '');
            cleanedResponse = cleanedResponse.replace(/^```\s*/i, '');
            cleanedResponse = cleanedResponse.replace(/\s*```$/i, '');
            
            // Try to extract JSON from response
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('❌ No JSON found in response');
                throw new Error('AI did not return valid JSON. Response may contain explanatory text instead of code changes.');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate required fields
            if (!parsed.changes || !Array.isArray(parsed.changes)) {
                console.error('❌ Response missing changes array');
                throw new Error('Invalid response format: missing changes array');
            }
            
            // Validate each change
            parsed.changes = parsed.changes.map((change, index) => {
                if (!change.file) {
                    console.error(`❌ Change ${index} missing file path:`, change);
                    throw new Error(`Change ${index} missing file path`);
                }
                
                // Validate action
                const validActions = ['edit', 'create', 'delete'];
                const action = change.action || 'edit';
                if (!validActions.includes(action)) {
                    console.warn(`⚠️ Invalid action "${action}", defaulting to "edit"`);
                }
                
                // Validate content for edit/create actions
                if ((action === 'edit' || action === 'create') && !change.newContent && !change.content) {
                    console.error(`❌ Change ${index} missing content for ${action} action`);
                    throw new Error(`Change ${index} requires newContent for ${action} action`);
                }
                
                // Check for placeholder comments (indicates incomplete work)
                const content = change.newContent || change.content || '';
                const hasPlaceholders = content.includes('// TODO') || 
                                       content.includes('// ... existing code ...') ||
                                       content.includes('// Add code here');
                if (hasPlaceholders) {
                    console.warn(`⚠️ File ${change.file} contains placeholder comments - may be incomplete`);
                }
                
                return {
                    file: change.file,
                    action: validActions.includes(action) ? action : 'edit',
                    newContent: change.newContent || change.content || '',
                    summary: change.summary || `${action === 'create' ? 'Created' : action === 'delete' ? 'Deleted' : 'Updated'} file`
                };
            });
            
            console.log(`✅ Parsed ${parsed.changes.length} file change(s)`);
            console.log('📝 Files:', parsed.changes.map(c => `${c.file} (${c.action})`).join(', '));
            
            // Log statistics
            const stats = {
                edited: parsed.changes.filter(c => c.action === 'edit').length,
                created: parsed.changes.filter(c => c.action === 'create').length,
                deleted: parsed.changes.filter(c => c.action === 'delete').length
            };
            console.log('📊 Stats:', `${stats.edited} edited, ${stats.created} created, ${stats.deleted} deleted`);
            
            return {
                type: 'code_edit',
                explanation: parsed.explanation || 'Code changes applied',
                changes: parsed.changes,
                affectedFiles: parsed.affectedFiles || parsed.changes.map(c => c.file),
                testingNotes: parsed.testingNotes || 'Verify changes in preview',
                stats
            };
            
        } catch (e) {
            console.error('❌ Failed to parse code edit response:', e.message);
            console.error('📄 Response preview:', response.substring(0, 500));
            
            // Return detailed error response
            return {
                type: 'code_edit',
                explanation: `Failed to parse AI response: ${e.message}. The AI may have outputted explanatory text or incomplete JSON instead of valid code changes. Please try rephrasing your request with more specific file names or paths.`,
                changes: [],
                affectedFiles: [],
                testingNotes: '',
                error: {
                    message: e.message,
                    responsePreview: response.substring(0, 300)
                }
            };
        }
    }

    /**
     * Handle question about the project
     */
    async handleQuestion(message, context) {
        // Build detailed context for answering questions
        let codeContext = '';
        if (context.latestCode && context.latestCode.files) {
            codeContext = '\n## PROJECT CODE:\n';
            context.latestCode.files.slice(0, 10).forEach(file => {
                codeContext += `### ${file.path}\n\`\`\`\n${file.content.substring(0, 1000)}...\n\`\`\`\n\n`;
            });
        }

        const prompt = [
            {
                role: 'system',
                content: `You are Shunya AI - an expert coding assistant with deep knowledge of the user's project.

You have access to:
- Complete conversation history
- Full project codebase
- Past code versions and changes
- Vector search results showing related discussions

When answering questions:
- Reference actual code from the project
- Explain clearly and concisely
- Use examples from the codebase when helpful
- Suggest improvements if relevant`
            },
            {
                role: 'user',
                content: `${context.summary}${codeContext}\n\n## User Question:\n${message}\n\nPlease answer based on the complete project context above.`
            }
        ];

        let response = '';
        for await (const chunk of this.llmService.streamCompletion(prompt)) {
            response += chunk;
        }

        return {
            type: 'answer',
            content: response
        };
    }

    /**
     * Handle general chat
     */
    async handleGeneralChat(message, context) {
        const prompt = [
            {
                role: 'system',
                content: 'You are a friendly AI coding assistant. Help the user with their project.'
            },
            {
                role: 'user',
                content: `${context.summary}\n\n${message}`
            }
        ];

        let response = '';
        for await (const chunk of this.llmService.streamCompletion(prompt)) {
            response += chunk;
        }

        return {
            type: 'chat',
            content: response
        };
    }

    /**
     * Save current project state
     */
    async saveProjectState(projectId, userId, files, description) {
        await this.vectorService.storeCodeSnapshot(projectId, userId, files, description);
    }
}

export default ContextualChatService;
