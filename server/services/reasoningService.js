import LLMService from './llmService.js';
import { createReasoningPrompt, createErrorFixingPrompt } from '../prompts/reasoning.js';

/**
 * Reasoning Service - Provides systematic chain-of-thought reasoning for code generation and error fixing
 * This service helps the AI think through problems before implementing solutions
 */
class ReasoningService {
    constructor(provider, apiKey, model) {
        this.llmService = new LLMService(provider, apiKey, model);
    }

    /**
     * Perform deep reasoning about a feature implementation
     * @param {string} userRequest - What the user wants to implement
     * @param {object} context - Additional context (existing files, history, etc.)
     * @returns {Promise<object>} - Structured reasoning output
     */
    async reasonAboutImplementation(userRequest, context = {}) {
        try {
            console.log('🧠 Starting implementation reasoning...');
            
            const reasoningMessages = createReasoningPrompt(userRequest, {
                ...context,
                type: 'implementation'
            });

            let reasoningResponse = '';
            
            // Stream the reasoning process
            for await (const chunk of this.llmService.streamCompletion(reasoningMessages)) {
                reasoningResponse += chunk;
            }

            // Parse the structured reasoning
            const reasoning = this.parseReasoningResponse(reasoningResponse);
            
            console.log('✅ Implementation reasoning complete');
            console.log('📊 Confidence:', reasoning.confidence?.overall || 'N/A');
            
            return reasoning;
            
        } catch (error) {
            console.error('❌ Reasoning failed:', error);
            
            // Return minimal reasoning if parsing fails
            return {
                thinking: {
                    understanding: {
                        problem: userRequest,
                        requirements: ['User request needs to be analyzed'],
                        context: 'Unable to perform deep reasoning',
                        successCriteria: ['Implement basic functionality']
                    }
                },
                confidence: {
                    overall: 0.5,
                    reasoning: 'Reasoning service encountered an error'
                },
                error: error.message
            };
        }
    }

    /**
     * Analyze and reason about how to fix an error
     * @param {string|object} errorInfo - Error message or error object
     * @param {array} existingFiles - Current project files
     * @returns {Promise<object>} - Structured error analysis and fix strategy
     */
    async reasonAboutErrorFix(errorInfo, existingFiles = []) {
        try {
            console.log('🔍 Starting error analysis reasoning...');
            
            const errorMessages = createErrorFixingPrompt(errorInfo, existingFiles);
            
            let reasoningResponse = '';
            
            for await (const chunk of this.llmService.streamCompletion(errorMessages)) {
                reasoningResponse += chunk;
            }

            const analysis = this.parseReasoningResponse(reasoningResponse);
            
            console.log('✅ Error analysis complete');
            
            if (analysis.errorAnalysis?.rootCause) {
                console.log('🎯 Root cause identified:', analysis.errorAnalysis.rootCause.fundamentalIssue);
            }
            
            return analysis;
            
        } catch (error) {
            console.error('❌ Error analysis failed:', error);
            
            return {
                errorAnalysis: {
                    identification: {
                        errorMessage: typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo),
                        errorType: 'unknown'
                    },
                    rootCause: {
                        fundamentalIssue: 'Unable to analyze error',
                        symptom: 'Analysis service error'
                    },
                    fixStrategy: {
                        selected: 'manual_review',
                        reasoning: 'Automatic analysis failed, manual review needed'
                    }
                },
                confidence: {
                    rootCauseIdentification: 0.3,
                    reasoning: 'Analysis service encountered an error'
                },
                error: error.message
            };
        }
    }

    /**
     * Get streaming reasoning output for real-time UI display
     * @param {string} userRequest - User's request
     * @param {object} context - Additional context
     * @yields {string} - Chunks of reasoning text
     */
    async *streamReasoning(userRequest, context = {}) {
        const reasoningMessages = createReasoningPrompt(userRequest, context);
        
        for await (const chunk of this.llmService.streamCompletion(reasoningMessages)) {
            yield chunk;
        }
    }

    /**
     * Get streaming error analysis for real-time UI display
     * @param {string|object} errorInfo - Error information
     * @param {array} existingFiles - Current files
     * @yields {string} - Chunks of analysis text
     */
    async *streamErrorAnalysis(errorInfo, existingFiles = []) {
        const errorMessages = createErrorFixingPrompt(errorInfo, existingFiles);
        
        for await (const chunk of this.llmService.streamCompletion(errorMessages)) {
            yield chunk;
        }
    }

    /**
     * Parse reasoning response into structured format
     * @param {string} response - Raw LLM response
     * @returns {object} - Parsed reasoning object
     */
    parseReasoningResponse(response) {
        try {
            // Clean markdown code blocks if present
            let cleanedResponse = response.trim();
            cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '');
            cleanedResponse = cleanedResponse.replace(/^```\s*/i, '');
            cleanedResponse = cleanedResponse.replace(/\s*```$/i, '');
            
            // Extract JSON from response
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('⚠️ No JSON found in reasoning response');
                throw new Error('No valid JSON in reasoning output');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate structure
            if (!parsed.thinking && !parsed.errorAnalysis) {
                console.warn('⚠️ Missing expected reasoning structure');
            }
            
            return parsed;
            
        } catch (error) {
            console.error('❌ Failed to parse reasoning:', error.message);
            console.error('📄 Response preview:', response.substring(0, 500));
            throw error;
        }
    }

    /**
     * Extract actionable insights from reasoning
     * @param {object} reasoning - Parsed reasoning object
     * @returns {object} - Key insights and recommendations
     */
    extractInsights(reasoning) {
        const insights = {
            keyDecisions: [],
            potentialRisks: [],
            recommendations: [],
            confidence: 0
        };

        if (reasoning.thinking) {
            // Extract from implementation reasoning
            const { solutionDesign, implementationPlan, qualityChecks } = reasoning.thinking;
            
            if (solutionDesign?.selectedApproach) {
                insights.keyDecisions.push({
                    type: 'architecture',
                    decision: solutionDesign.selectedApproach,
                    reasoning: solutionDesign.technicalDecisions?.reasoning
                });
            }
            
            if (implementationPlan?.potentialIssues) {
                insights.potentialRisks = implementationPlan.potentialIssues;
            }
            
            if (qualityChecks?.edgeCases) {
                insights.recommendations = qualityChecks.edgeCases.map(ec => ({
                    type: 'edge_case',
                    description: ec
                }));
            }
        }

        if (reasoning.errorAnalysis) {
            // Extract from error analysis
            const { rootCause, fixStrategy, validation } = reasoning.errorAnalysis;
            
            if (rootCause?.fundamentalIssue) {
                insights.keyDecisions.push({
                    type: 'root_cause',
                    decision: rootCause.fundamentalIssue,
                    reasoning: fixStrategy?.reasoning
                });
            }
            
            if (fixStrategy?.selected) {
                insights.keyDecisions.push({
                    type: 'fix_strategy',
                    decision: fixStrategy.selected,
                    reasoning: fixStrategy.reasoning
                });
            }
            
            if (validation?.testSteps) {
                insights.recommendations = validation.testSteps.map(step => ({
                    type: 'testing',
                    description: step
                }));
            }
        }

        insights.confidence = reasoning.confidence?.overall || 
                             reasoning.confidence?.rootCauseIdentification || 
                             0;
        
        if (reasoning.recommendations) {
            insights.recommendations.push(...reasoning.recommendations.map(rec => ({
                type: 'general',
                description: rec
            })));
        }

        return insights;
    }

    /**
     * Validate if reasoning output is complete and high quality
     * @param {object} reasoning - Parsed reasoning object
     * @returns {object} - Validation result with quality score
     */
    validateReasoning(reasoning) {
        const validation = {
            isValid: true,
            qualityScore: 0,
            issues: [],
            strengths: []
        };

        let score = 0;
        const maxScore = 100;

        // Check for implementation reasoning structure
        if (reasoning.thinking) {
            const { understanding, solutionDesign, implementationPlan, qualityChecks } = reasoning.thinking;
            
            if (understanding?.problem) {
                score += 15;
                validation.strengths.push('Clear problem understanding');
            } else {
                validation.issues.push('Missing problem understanding');
            }
            
            if (solutionDesign?.alternatives && solutionDesign.alternatives.length > 1) {
                score += 20;
                validation.strengths.push('Considered multiple approaches');
            } else {
                validation.issues.push('Did not explore alternatives');
            }
            
            if (implementationPlan?.files && implementationPlan.files.length > 0) {
                score += 20;
                validation.strengths.push('Detailed implementation plan');
            } else {
                validation.issues.push('Missing implementation details');
            }
            
            if (qualityChecks?.edgeCases && qualityChecks.edgeCases.length > 0) {
                score += 15;
                validation.strengths.push('Identified edge cases');
            }
        }

        // Check for error analysis structure
        if (reasoning.errorAnalysis) {
            const { identification, rootCause, fixStrategy, validation: val } = reasoning.errorAnalysis;
            
            if (rootCause?.whyChain && rootCause.whyChain.length >= 3) {
                score += 25;
                validation.strengths.push('Deep root cause analysis');
            } else {
                validation.issues.push('Shallow root cause analysis');
            }
            
            if (fixStrategy?.selected && fixStrategy.reasoning) {
                score += 20;
                validation.strengths.push('Clear fix strategy with reasoning');
            } else {
                validation.issues.push('Unclear fix strategy');
            }
            
            if (val?.testSteps && val.testSteps.length > 0) {
                score += 15;
                validation.strengths.push('Comprehensive validation plan');
            }
        }

        // Check confidence
        if (reasoning.confidence?.overall >= 0.8) {
            score += 10;
            validation.strengths.push('High confidence in analysis');
        } else if (reasoning.confidence?.overall < 0.5) {
            validation.issues.push('Low confidence in analysis');
        }

        validation.qualityScore = score;
        validation.isValid = score >= 50 && validation.issues.length < 3;

        return validation;
    }
}

export default ReasoningService;
