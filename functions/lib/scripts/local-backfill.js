"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("firebase-admin/app");
const backfill_1 = require("../backfill");
// Initialize Admin SDK
// key must be set via GOOGLE_APPLICATION_CREDENTIALS for local run or use default logic if authenticated via gcloud
(0, app_1.initializeApp)();
async function main() {
    console.log("Starting local backfill...");
    try {
        const result = await (0, backfill_1.backfillEmbeddingsHandler)();
        console.log("Backfill complete:", result);
    }
    catch (error) {
        console.error("Backfill failed:", error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=local-backfill.js.map