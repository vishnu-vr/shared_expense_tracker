"use strict";
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillEmbeddings = exports.analyzeTransactions = exports.onTransactionCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const genkit_1 = require("genkit");
const google_genai_1 = require("@genkit-ai/google-genai");
const firestore_2 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
(0, app_1.initializeApp)();
const ai = (0, genkit_1.genkit)({
    plugins: [(0, google_genai_1.vertexAI)({ location: 'us-central1' })],
});
exports.onTransactionCreated = (0, firestore_1.onDocumentCreated)("transactions/{docId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const data = snapshot.data();
    const { note, amount, categoryId } = data;
    // Skip if no useful content to analyze
    if (!note && !amount) {
        return;
    }
    try {
        // 1. Generate Embeddings for Semantic Search
        // Combine fields for a richer context, but prioritize 'note'
        const textToEmbed = `${note || ''} ${categoryId || ''} ${amount || ''}`;
        const embedding = await ai.embed({
            embedder: google_genai_1.vertexAI.embedder('text-embedding-004'),
            content: textToEmbed,
        });
        // 2. Update the document with just the embedding
        await snapshot.ref.update({
            embedding: firestore_2.FieldValue.vector(embedding[0].embedding),
            // ai_suggested_category: skipped for now
        });
        logger.info(`Processed transaction ${event.params.docId}: Added embedding.`);
    }
    catch (error) {
        logger.error("Error processing transaction", error);
    }
});
// Define the schema for the flow input
const TransactionQuerySchema = genkit_1.z.object({
    question: genkit_1.z.string(),
});
// Define the retriever manually to allow filtering by userId
// Note: 'defineFirestoreRetriever' is often a custom wrapper or part of experimental plugins.
// We will use ai.defineRetriever for maximum control and correctness.
const transactionRetriever = ai.defineRetriever({
    name: "transactionRetriever",
    // No options needed for global search
}, async (content) => {
    const embedding = await ai.embed({
        embedder: google_genai_1.vertexAI.embedder('text-embedding-004'),
        content: content.text,
    });
    const firestore = (0, firestore_2.getFirestore)();
    const collection = firestore.collection("transactions");
    // Vector Search (Global)
    // Note: You need to create a Vector Index in Firestore for this to work.
    const vectorQuery = collection
        .findNearest("embedding", firestore_2.FieldValue.vector(embedding[0].embedding), {
        limit: 5,
        distanceMeasure: "COSINE",
    });
    const querySnapshot = await vectorQuery.get();
    return {
        documents: querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                content: [
                    { text: `Date: ${data.date}` },
                    { text: `Amount: ${data.amount}` },
                    { text: `Note: ${data.note}` },
                    { text: `Category: ${data.ai_suggested_category || data.categoryId}` }, // Use AI category if available
                ],
                metadata: { id: doc.id },
            };
        }),
    };
});
// Define the Flow using Genkit 1.x API
const analyzeTransactionsFlow = ai.defineFlow({
    name: "analyzeTransactions",
    inputSchema: TransactionQuerySchema,
    outputSchema: genkit_1.z.string(),
}, async ({ question }) => {
    // Retrieve relevant transactions
    const docs = await ai.retrieve({
        retriever: transactionRetriever,
        query: question,
    });
    // Generate answer
    const { text } = await ai.generate({
        model: google_genai_1.vertexAI.model('gemini-1.5-flash'),
        prompt: `
        You are a helpful financial assistant.
        Answer the user's question based ONLY on the following transactions.
        
        User Question: ${question}
        
        Transactions:
        ${docs.map((d) => d.content.map((p) => 'text' in p ? p.text : '').join('\n')).join("\n\n")}
        
        If the information is not in the transactions, say so.
        Provide a concise and helpful answer.
      `,
    });
    return text;
});
// Expose the flow as a Firebase callable function
exports.analyzeTransactions = (0, https_1.onCall)(async (request) => {
    const { question } = request.data;
    if (!question || typeof question !== 'string') {
        throw new Error('Invalid request: question is required');
    }
    return await analyzeTransactionsFlow({ question });
});
// Backfill Embeddings for existing transactions
// Call via: firebase functions:shell -> backfillEmbeddings({}) or via client SDK
exports.backfillEmbeddings = (0, https_1.onCall)(async () => {
    const firestore = (0, firestore_2.getFirestore)();
    const collection = firestore.collection("transactions");
    // Get all transactions without embeddings
    // Note: 'embedding' equality check might not be efficient or possible depending on index,
    // so we iterate all and check. For large datasets, use cursor/pagination.
    const snapshot = await collection.get();
    let processedCount = 0;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        // Skip if already has embedding
        // Note: Check if field valid vector or array
        if (data.embedding) {
            continue;
        }
        const { note, amount, categoryId } = data;
        // Skip if not enough info
        if (!note && !amount) {
            continue;
        }
        try {
            const textToEmbed = `${note || ''} ${categoryId || ''} ${amount || ''}`;
            const embedding = await ai.embed({
                embedder: google_genai_1.vertexAI.embedder('text-embedding-004'),
                content: textToEmbed,
            });
            await doc.ref.update({
                embedding: firestore_2.FieldValue.vector(embedding[0].embedding),
            });
            processedCount++;
            logger.info(`Backfilled embedding for ${doc.id}`);
        }
        catch (error) {
            logger.error(`Error backfilling ${doc.id}`, error);
        }
    }
    return { success: true, processed: processedCount };
});
//# sourceMappingURL=index.js.map