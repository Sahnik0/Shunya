import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

class VectorService {
    constructor() {
        this.client = null;
        this.db = null;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.vectorIndexName = process.env.VECTOR_INDEX_NAME || 'vector_index';
        this.embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
    }

    async connect() {
        if (this.client) return;
        
        try {
            this.client = new MongoClient(process.env.MONGODB_URI);
            await this.client.connect();
            this.db = this.client.db('shunya');
            console.log('✅ Vector Service connected to MongoDB Atlas');
        } catch (error) {
            console.error('❌ Vector Service connection failed:', error);
            throw error;
        }
    }

    /**
     * Generate embedding vector from text using Gemini
     */
    async createEmbedding(text) {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
            const result = await model.embedContent(text);
            
            return result.embedding.values;
        } catch (error) {
            console.error('❌ Failed to create embedding:', error);
            throw error;
        }
    }

    /**
     * Store chat message with embedding
     */
    async storeChatMessage(projectId, userId, message, role = 'user') {
        await this.connect();

        try {
            const embedding = await this.createEmbedding(message);
            
            const document = {
                projectId,
                userId,
                type: 'chat_message',
                role,
                content: message,
                embedding,
                timestamp: new Date(),
                metadata: {
                    messageLength: message.length
                }
            };

            const result = await this.db.collection('vectors').insertOne(document);
            console.log('✅ Stored chat message with embedding');
            return result.insertedId;
        } catch (error) {
            console.error('❌ Failed to store chat message:', error);
            throw error;
        }
    }

    /**
     * Store code snapshot with embedding
     */
    async storeCodeSnapshot(projectId, userId, files, description) {
        await this.connect();

        try {
            // Create a searchable representation of the code
            const codeText = files.map(f => 
                `File: ${f.path}\n${f.content}`
            ).join('\n\n');

            const searchableText = `${description}\n\n${codeText.substring(0, 8000)}`; // Limit for embedding
            const embedding = await this.createEmbedding(searchableText);
            
            const document = {
                projectId,
                userId,
                type: 'code_snapshot',
                description,
                files: files.map(f => ({
                    path: f.path,
                    content: f.content,
                    hash: this.hashContent(f.content)
                })),
                embedding,
                timestamp: new Date(),
                metadata: {
                    fileCount: files.length,
                    totalSize: codeText.length
                }
            };

            const result = await this.db.collection('vectors').insertOne(document);
            console.log('✅ Stored code snapshot with embedding');
            return result.insertedId;
        } catch (error) {
            console.error('❌ Failed to store code snapshot:', error);
            throw error;
        }
    }

    /**
     * Search for similar context using vector similarity
     */
    async searchSimilarContext(projectId, userId, query, limit = 10) {
        await this.connect();

        try {
            const queryEmbedding = await this.createEmbedding(query);

            const pipeline = [
                {
                    $vectorSearch: {
                        index: this.vectorIndexName,
                        path: 'embedding',
                        queryVector: queryEmbedding,
                        numCandidates: limit * 10,
                        limit: limit,
                        filter: {
                            projectId: { $eq: projectId },
                            userId: { $eq: userId }
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        projectId: 1,
                        type: 1,
                        role: 1,
                        content: 1,
                        description: 1,
                        files: 1,
                        timestamp: 1,
                        score: { $meta: 'vectorSearchScore' }
                    }
                }
            ];

            const results = await this.db.collection('vectors')
                .aggregate(pipeline)
                .toArray();

            console.log(`✅ Found ${results.length} similar contexts with scores:`, 
                results.map(r => r.score?.toFixed(3)));
            
            return results;
        } catch (error) {
            console.error('❌ Vector search failed:', error);
            throw error;
        }
    }

    /**
     * Get recent chat history
     */
    async getRecentHistory(projectId, userId, limit = 20) {
        await this.connect();

        try {
            const messages = await this.db.collection('vectors')
                .find({
                    projectId,
                    userId,
                    type: 'chat_message'
                })
                .sort({ timestamp: -1 })
                .limit(limit)
                .toArray();

            return messages.reverse(); // Chronological order
        } catch (error) {
            console.error('❌ Failed to get chat history:', error);
            throw error;
        }
    }

    /**
     * Get latest code snapshot
     */
    async getLatestCodeSnapshot(projectId, userId) {
        await this.connect();

        try {
            const snapshot = await this.db.collection('vectors')
                .findOne(
                    {
                        projectId,
                        userId,
                        type: 'code_snapshot'
                    },
                    {
                        sort: { timestamp: -1 }
                    }
                );

            return snapshot;
        } catch (error) {
            console.error('❌ Failed to get code snapshot:', error);
            throw error;
        }
    }

    /**
     * Build context for AI from history and similar content
     */
    async buildContextForAI(projectId, userId, currentQuery) {
        await this.connect();

        try {
            // Get recent history
            const recentHistory = await this.getRecentHistory(projectId, userId, 10);
            
            // Get similar context using vector search
            const similarContext = await this.searchSimilarContext(projectId, userId, currentQuery, 5);
            
            // Get latest code
            const latestCode = await this.getLatestCodeSnapshot(projectId, userId);

            return {
                recentHistory,
                similarContext,
                latestCode,
                summary: this.summarizeContext(recentHistory, similarContext, latestCode)
            };
        } catch (error) {
            console.error('❌ Failed to build context:', error);
            return {
                recentHistory: [],
                similarContext: [],
                latestCode: null,
                summary: ''
            };
        }
    }

    /**
     * Summarize context for AI prompt
     */
    summarizeContext(recentHistory, similarContext, latestCode) {
        let summary = '';

        // Recent conversation
        if (recentHistory.length > 0) {
            summary += '## Recent Conversation:\n';
            recentHistory.slice(-5).forEach(msg => {
                summary += `${msg.role}: ${msg.content}\n`;
            });
            summary += '\n';
        }

        // Current code state
        if (latestCode) {
            summary += '## Current Project State:\n';
            summary += `Description: ${latestCode.description}\n`;
            summary += `Files: ${latestCode.files.length} files\n`;
            summary += 'File Structure:\n';
            latestCode.files.forEach(f => {
                summary += `- ${f.path}\n`;
            });
            summary += '\n';
        }

        // Relevant past context
        if (similarContext.length > 0) {
            summary += '## Relevant Past Context:\n';
            similarContext.slice(0, 3).forEach(ctx => {
                if (ctx.type === 'chat_message') {
                    summary += `- ${ctx.role}: ${ctx.content.substring(0, 100)}...\n`;
                } else if (ctx.type === 'code_snapshot') {
                    summary += `- Code version: ${ctx.description}\n`;
                }
            });
        }

        return summary;
    }

    /**
     * Hash content for change detection
     */
    hashContent(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Close connection
     */
    async close() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            console.log('✅ Vector Service disconnected');
        }
    }
}

export default VectorService;
