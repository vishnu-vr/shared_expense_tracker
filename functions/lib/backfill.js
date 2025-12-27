"use strict";
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
exports.backfillEmbeddingsHandler = void 0;
const logger = __importStar(require("firebase-functions/logger"));
const firestore_1 = require("firebase-admin/firestore");
const google_genai_1 = require("@genkit-ai/google-genai");
const genkit_1 = require("./genkit");
const backfillEmbeddingsHandler = async () => {
    const firestore = (0, firestore_1.getFirestore)();
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
            const embedding = await genkit_1.ai.embed({
                embedder: google_genai_1.vertexAI.embedder('text-embedding-004'),
                content: textToEmbed,
            });
            await doc.ref.update({
                embedding: firestore_1.FieldValue.vector(embedding[0].embedding),
            });
            processedCount++;
            logger.info(`Backfilled embedding for ${doc.id}`);
        }
        catch (error) {
            logger.error(`Error backfilling ${doc.id}`, error);
        }
    }
    return { success: true, processed: processedCount };
};
exports.backfillEmbeddingsHandler = backfillEmbeddingsHandler;
//# sourceMappingURL=backfill.js.map