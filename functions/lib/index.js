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
exports.analyzeTransactions = exports.analyzeTransactionsHandler = exports.onTransactionCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const genkit_1 = require("genkit");
const google_genai_1 = require("@genkit-ai/google-genai");
const firestore_2 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
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
// Helper to format date for display
function formatDate(dateValue) {
    if (!dateValue)
        return 'Unknown';
    // Handle Firestore Timestamp
    if (dateValue.toDate) {
        return dateValue.toDate().toISOString().split('T')[0];
    }
    // Handle ISO string
    if (typeof dateValue === 'string') {
        return new Date(dateValue).toISOString().split('T')[0];
    }
    return String(dateValue);
}
// Fetch transactions for a specific time period
async function getTransactionsForPeriod(startDate, endDate) {
    const firestore = (0, firestore_2.getFirestore)();
    const snapshot = await firestore
        .collection("transactions")
        .where("date", ">=", startDate.toISOString())
        .where("date", "<=", endDate.toISOString())
        .orderBy("date", "desc")
        .get();
    return snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
}
// Fetch recent transactions (fallback)
async function getRecentTransactions(limit = 200) {
    const firestore = (0, firestore_2.getFirestore)();
    const snapshot = await firestore
        .collection("transactions")
        .orderBy("date", "desc")
        .limit(limit)
        .get();
    return snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
}
// Parse time period from question
function getDateRangeFromQuestion(question, now) {
    const q = question.toLowerCase();
    if (q.includes('last month')) {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { start, end };
    }
    if (q.includes('this month')) {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return { start, end };
    }
    if (q.includes('last week')) {
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }
    if (q.includes('this week')) {
        const dayOfWeek = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }
    if (q.includes('yesterday')) {
        const start = new Date(now);
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59);
        return { start, end };
    }
    if (q.includes('today')) {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }
    return null;
}
// Define the retriever for semantic search
const transactionRetriever = ai.defineRetriever({
    name: "transactionRetriever",
}, async (content) => {
    const embedding = await ai.embed({
        embedder: google_genai_1.vertexAI.embedder('text-embedding-004'),
        content: content.text,
    });
    const firestore = (0, firestore_2.getFirestore)();
    const collection = firestore.collection("transactions");
    // Vector Search - increased limit for better coverage
    const vectorQuery = collection
        .findNearest("embedding", firestore_2.FieldValue.vector(embedding[0].embedding), {
        limit: 20,
        distanceMeasure: "COSINE",
    });
    const querySnapshot = await vectorQuery.get();
    return {
        documents: querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                content: [
                    { text: `Date: ${formatDate(data.date)}, Amount: ${data.amount}, Category: ${data.categoryId}, Note: ${data.note || 'N/A'}` },
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
    // Get current date for context
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    // Calculate last month
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthName = lastMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    // Detect if this is a time-based query and get date range
    const dateRange = getDateRangeFromQuestion(question, now);
    const timeKeywords = ['last month', 'this month', 'yesterday', 'today', 'last week', 'this week', 'recent', 'lately'];
    const isTimeQuery = timeKeywords.some(kw => question.toLowerCase().includes(kw));
    let transactionsContext = '';
    if (dateRange) {
        // For specific time periods, query with date filter
        logger.info(`Querying transactions from ${dateRange.start.toISOString()} to ${dateRange.end.toISOString()}`);
        const periodTxns = await getTransactionsForPeriod(dateRange.start, dateRange.end);
        logger.info(`Found ${periodTxns.length} transactions in period`);
        transactionsContext = periodTxns
            .map(t => `Date: ${formatDate(t.date)}, Amount: ${t.amount}, Category: ${t.categoryId}, Note: ${t.note || 'N/A'}`)
            .join('\n');
        if (periodTxns.length === 0) {
            transactionsContext = 'No transactions found for this time period.';
        }
    }
    else if (isTimeQuery) {
        // For general time queries, get recent transactions
        const recentTxns = await getRecentTransactions(200);
        transactionsContext = recentTxns
            .map(t => `Date: ${formatDate(t.date)}, Amount: ${t.amount}, Category: ${t.categoryId}, Note: ${t.note || 'N/A'}`)
            .join('\n');
    }
    else {
        // For semantic queries, use vector search
        const docs = await ai.retrieve({
            retriever: transactionRetriever,
            query: question,
        });
        transactionsContext = docs
            .map((d) => d.content.map((p) => 'text' in p ? p.text : '').join(''))
            .join('\n');
    }
    // Generate answer with improved prompt
    const { text } = await ai.generate({
        model: google_genai_1.vertexAI.model('gemini-2.0-flash'),
        prompt: `You are a helpful and friendly financial assistant analyzing personal expense data.

CURRENT DATE: ${currentDate}
CURRENT MONTH: ${currentMonth}
LAST MONTH: ${lastMonthName}

USER QUESTION: ${question}

TRANSACTION DATA:
${transactionsContext}

INSTRUCTIONS:
1. Use the current date to correctly interpret relative time references (e.g., "last month" = ${lastMonthName})
2. Filter the transactions based on the time period mentioned in the question
3. Calculate totals, averages, or breakdowns as needed
4. If asked about spending by category, group and sum the amounts
5. Format currency amounts nicely (e.g., ₹1,234.56)
6. If no relevant transactions are found for the time period, say so clearly
7. Be concise but informative
8. If the question is vague, provide a helpful summary

Provide your answer:`,
    });
    return text;
});
// Logic handler exported for testing
const analyzeTransactionsHandler = async (request) => {
    var _a, _b, _c, _d;
    // 1. Check if authenticated via standard Firebase SDK
    let uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    let email = (_c = (_b = request.auth) === null || _b === void 0 ? void 0 : _b.token) === null || _c === void 0 ? void 0 : _c.email;
    // 2. If not, check for Authorization header manually (fallback)
    if (!uid) {
        const authHeader = (_d = request.rawRequest) === null || _d === void 0 ? void 0 : _d.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split('Bearer ')[1];
            try {
                const decodedToken = await (0, auth_1.getAuth)().verifyIdToken(token);
                uid = decodedToken.uid;
                email = decodedToken.email;
            }
            catch (e) {
                logger.warn("Failed to verify token from header", e);
            }
        }
    }
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    // 3. Email Allowlist Check
    const ALLOWED_EMAILS = [];
    if (!email || !ALLOWED_EMAILS.includes(email)) {
        logger.warn(`Permission denied for user ${uid} with email ${email}`);
        throw new https_1.HttpsError('permission-denied', `User ${email} is not authorized to use this feature.`);
    }
    logger.info(`AnalyzeTransactions called by user: ${uid} (${email})`);
    const { question } = request.data;
    if (!question || typeof question !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'The function must be called with a "question" argument.');
    }
    return await analyzeTransactionsFlow({ question });
};
exports.analyzeTransactionsHandler = analyzeTransactionsHandler;
// Expose the flow as a Firebase callable function
exports.analyzeTransactions = (0, https_1.onCall)(exports.analyzeTransactionsHandler);
// // Backfill Embeddings for existing transactions
// // Call via: firebase functions:shell -> backfillEmbeddings({}) or via client SDK
// export const backfillEmbeddings = onCall(async () => {
//     const firestore = getFirestore();
//     const collection = firestore.collection("transactions");
//     // Get all transactions without embeddings
//     // Note: 'embedding' equality check might not be efficient or possible depending on index,
//     // so we iterate all and check. For large datasets, use cursor/pagination.
//     const snapshot = await collection.get();
//     let processedCount = 0;
//     for (const doc of snapshot.docs) {
//         const data = doc.data();
//         // Skip if already has embedding
//         // Note: Check if field valid vector or array
//         if (data.embedding) {
//             continue;
//         }
//         const { note, amount, categoryId } = data;
//         // Skip if not enough info
//         if (!note && !amount) {
//             continue;
//         }
//         try {
//             const textToEmbed = `${note || ''} ${categoryId || ''} ${amount || ''}`;
//             const embedding = await ai.embed({
//                 embedder: vertexAI.embedder('text-embedding-004'),
//                 content: textToEmbed,
//             });
//             await doc.ref.update({
//                 embedding: FieldValue.vector(embedding[0].embedding),
//             });
//             processedCount++;
//             logger.info(`Backfilled embedding for ${doc.id}`);
//         } catch (error) {
//             logger.error(`Error backfilling ${doc.id}`, error);
//         }
//     }
//     return { success: true, processed: processedCount };
// });
//# sourceMappingURL=index.js.map