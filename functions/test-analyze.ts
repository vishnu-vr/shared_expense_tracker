/**
 * Simple test script for analyzeTransactions
 * 
 * Usage: npx ts-node test-analyze.ts "Your question here"
 */

// Set credentials FIRST
process.env.GOOGLE_APPLICATION_CREDENTIALS = './service-account.json';
process.env.GCLOUD_PROJECT = 'expense-tracker-e7ff7';

async function main() {
    try {
        console.log('🚀 Starting test...\n');
        
        // Import after setting env vars
        const { initializeApp, cert } = await import('firebase-admin/app');
        const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
        const { genkit } = await import('genkit');
        const { vertexAI } = await import('@genkit-ai/google-genai');
        
        // Load service account
        const serviceAccount = require('./service-account.json');
        console.log(`📁 Using project: ${serviceAccount.project_id}\n`);
        
        // Initialize Firebase
        initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
        });
        
        const firestore = getFirestore();
        
        // Initialize Genkit
        const ai = genkit({
            plugins: [vertexAI({ 
                location: 'us-central1',
                projectId: serviceAccount.project_id,
            })],
        });
        
        // Get question from command line
        const question = process.argv.slice(2).join(' ') || 'What are my recent expenses?';
        console.log(`❓ Question: "${question}"\n`);
        
        // Step 1: Check if we have transactions with embeddings
        console.log('📊 Checking transactions...');
        const sampleDocs = await firestore.collection('transactions').limit(3).get();
        console.log(`   Found ${sampleDocs.size} sample transactions`);
        
        if (sampleDocs.size > 0) {
            const firstDoc = sampleDocs.docs[0].data();
            console.log(`   First doc has embedding: ${!!firstDoc.embedding}`);
            if (firstDoc.embedding) {
                console.log(`   Embedding length: ${firstDoc.embedding.length || 'unknown'}`);
            }
        }
        console.log('');
        
        // Step 2: Generate embedding for the question
        console.log('🔤 Generating question embedding...');
        const questionEmbedding = await ai.embed({
            embedder: vertexAI.embedder('text-embedding-004'),
            content: question,
        });
        console.log(`   ✅ Generated embedding with ${questionEmbedding[0].embedding.length} dimensions\n`);
        
        // Step 3: Vector search
        console.log('🔍 Performing vector search...');
        const collection = firestore.collection('transactions');
        
        const vectorQuery = collection.findNearest(
            'embedding',
            FieldValue.vector(questionEmbedding[0].embedding),
            {
                limit: 5,
                distanceMeasure: 'COSINE',
            }
        );
        
        const querySnapshot = await vectorQuery.get();
        console.log(`   ✅ Found ${querySnapshot.size} relevant transactions\n`);
        
        if (querySnapshot.size === 0) {
            console.log('⚠️  No transactions found with embeddings. Run backfill first.');
            process.exit(1);
        }
        
        // Step 4: Format transactions
        console.log('📋 Retrieved transactions:');
        console.log('─'.repeat(60));
        
        const transactionsContext = querySnapshot.docs.map((doc, i) => {
            const data = doc.data();
            const line = `${i + 1}. Date: ${data.date || 'N/A'}, Amount: ${data.amount || 'N/A'}, Note: ${data.note || 'N/A'}, Category: ${data.categoryId || 'N/A'}`;
            console.log(line);
            return line;
        }).join('\n');
        
        console.log('─'.repeat(60));
        console.log('');
        
        // Step 5: Generate answer with Gemini
        console.log('🤖 Generating answer with Gemini...\n');
        
        const prompt = `You are a helpful financial assistant.
Answer the user's question based ONLY on the following transactions.

User Question: ${question}

Transactions:
${transactionsContext}

If the information is not in the transactions, say so.
Provide a concise and helpful answer.`;

        const response = await ai.generate({
            model: vertexAI.model('gemini-2.0-flash'),
            prompt: prompt,
        });
        
        console.log('💬 Answer:');
        console.log('═'.repeat(60));
        console.log(response.text);
        console.log('═'.repeat(60));
        
    } catch (error: any) {
        console.error('\n❌ Error occurred:');
        console.error('─'.repeat(60));
        console.error('Message:', error.message);
        if (error.code) console.error('Code:', error.code);
        if (error.details) console.error('Details:', error.details);
        console.error('─'.repeat(60));
        console.error('\nFull error:');
        console.error(error);
    }
    
    process.exit(0);
}

main();

