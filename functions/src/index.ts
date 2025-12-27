/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { genkit, z } from "genkit";
import { vertexAI } from "@genkit-ai/google-genai";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

initializeApp();

const ai = genkit({
    plugins: [vertexAI({ location: 'us-central1' })],
});

export const onTransactionCreated = onDocumentCreated("transactions/{docId}", async (event) => {
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
            embedder: vertexAI.embedder('text-embedding-004'),
            content: textToEmbed,
        });

        // 2. Update the document with just the embedding
        await snapshot.ref.update({
            embedding: FieldValue.vector(embedding[0].embedding),
            // ai_suggested_category: skipped for now
        });

        logger.info(`Processed transaction ${event.params.docId}: Added embedding.`);

    } catch (error) {
        logger.error("Error processing transaction", error);
    }
});

// Define the schema for the flow input
const TransactionQuerySchema = z.object({
    question: z.string(),
});

// Define the retriever manually to allow filtering by userId
// Note: 'defineFirestoreRetriever' is often a custom wrapper or part of experimental plugins.
// We will use ai.defineRetriever for maximum control and correctness.
const transactionRetriever = ai.defineRetriever(
    {
        name: "transactionRetriever",
        // No options needed for global search
    },
    async (content) => {
        const embedding = await ai.embed({
            embedder: vertexAI.embedder('text-embedding-004'),
            content: content.text,
        });

        const firestore = getFirestore();
        const collection = firestore.collection("transactions");

        // Vector Search (Global)
        // Note: You need to create a Vector Index in Firestore for this to work.
        const vectorQuery = collection
            .findNearest("embedding", FieldValue.vector(embedding[0].embedding), {
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
    }
);

// Define the Flow using Genkit 1.x API
const analyzeTransactionsFlow = ai.defineFlow(
    {
        name: "analyzeTransactions",
        inputSchema: TransactionQuerySchema,
        outputSchema: z.string(),
    },
    async ({ question }) => {
        // Retrieve relevant transactions
        const docs = await ai.retrieve({
            retriever: transactionRetriever,
            query: question,
        });

        // Generate answer
        const { text } = await ai.generate({
            model: vertexAI.model('gemini-2.0-flash'),
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
    }
);

// Expose the flow as a Firebase callable function
export const analyzeTransactions = onCall(async (request) => {
    const { question } = request.data;
    if (!question || typeof question !== 'string') {
        throw new Error('Invalid request: question is required');
    }
    return await analyzeTransactionsFlow({ question });
});

// Backfill Embeddings for existing transactions
// Call via: firebase functions:shell -> backfillEmbeddings({}) or via client SDK
export const backfillEmbeddings = onCall(async () => {
    const firestore = getFirestore();
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
                embedder: vertexAI.embedder('text-embedding-004'),
                content: textToEmbed,
            });

            await doc.ref.update({
                embedding: FieldValue.vector(embedding[0].embedding),
            });

            processedCount++;
            logger.info(`Backfilled embedding for ${doc.id}`);

        } catch (error) {
            logger.error(`Error backfilling ${doc.id}`, error);
        }
    }

    return { success: true, processed: processedCount };
});
