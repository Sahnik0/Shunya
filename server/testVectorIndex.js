import { MongoClient } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

async function testVectorIndex() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        console.log('🔍 Testing MongoDB Vector Search setup...\n');
        
        await client.connect();
        const db = client.db('shunya');
        
        // Test 1: Check if vectors collection exists
        const collections = await db.listCollections().toArray();
        const hasVectorsCollection = collections.some(c => c.name === 'vectors');
        
        console.log(`1. Vectors collection: ${hasVectorsCollection ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        
        // Test 2: Insert a test document with embedding
        console.log('\n2. Testing Gemini embeddings...');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
        const result = await model.embedContent('test message');
        const embedding = result.embedding.values;
        
        console.log(`   ✅ Embedding created: ${embedding.length} dimensions`);
        
        // Test 3: Try vector search
        console.log('\n3. Testing $vectorSearch...');
        try {
            const pipeline = [
                {
                    $vectorSearch: {
                        index: 'vector_index',
                        path: 'embedding',
                        queryVector: embedding,
                        numCandidates: 10,
                        limit: 5
                    }
                }
            ];
            
            await db.collection('vectors').aggregate(pipeline).toArray();
            console.log('   ✅ Vector search is working!');
            
        } catch (searchError) {
            if (searchError.message.includes('$vectorSearch')) {
                console.log('   ❌ $vectorSearch not supported');
                console.log('   📌 Your cluster needs to be M10+ (not M0/M2/M5)');
            } else if (searchError.message.includes('index')) {
                console.log('   ❌ Vector index "vector_index" not found');
                console.log('\n   📌 CREATE VECTOR INDEX:');
                console.log('   1. Go to: https://cloud.mongodb.com');
                console.log('   2. Select your cluster → Database → Atlas Search');
                console.log('   3. Click "Create Search Index" → JSON Editor');
                console.log('   4. Database: shunya, Collection: vectors');
                console.log('   5. Paste this JSON:\n');
                console.log(JSON.stringify({
                    "fields": [
                        {
                            "type": "vector",
                            "path": "embedding",
                            "numDimensions": 768,
                            "similarity": "cosine"
                        },
                        {
                            "type": "filter",
                            "path": "projectId"
                        },
                        {
                            "type": "filter",
                            "path": "userId"
                        }
                    ]
                }, null, 2));
                console.log('\n   6. Index Name: vector_index');
                console.log('   7. Click "Create Search Index"');
            } else {
                console.log('   ❌ Unknown error:', searchError.message);
            }
        }
        
        console.log('\n✅ Vector test complete!\n');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await client.close();
    }
}

testVectorIndex();
