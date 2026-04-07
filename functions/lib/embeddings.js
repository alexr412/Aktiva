"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearchVector = exports.onActivityUpdated = exports.onActivityCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const genkit_1 = require("genkit");
const google_genai_1 = require("@genkit-ai/google-genai");
if (!admin.apps.length) {
    admin.initializeApp();
}
const ai = (0, genkit_1.genkit)({
    plugins: [(0, google_genai_1.googleAI)()],
    model: 'googleai/gemini-2.5-flash',
});
const embeddingModel = 'googleai/gemini-embedding-001';
async function generateVector(text) {
    try {
        const embeddingResponse = await ai.embed({
            embedder: embeddingModel,
            content: text,
        });
        return embeddingResponse[0].embedding.slice(0, 768);
    }
    catch (error) {
        console.error("Error generating vector:", error);
        throw error;
    }
}
exports.onActivityCreated = (0, firestore_1.onDocumentCreated)("activities/{activityId}", async (event) => {
    const snap = event.data;
    if (!snap)
        return null;
    const data = snap.data();
    const content = `${data.placeName || ""} ${data.category || ""} ${data.description || ""}`.trim();
    if (!content)
        return null;
    try {
        const vector = await generateVector(content);
        return snap.ref.update({
            embeddingVector: firestore_2.FieldValue.vector(vector)
        });
    }
    catch (error) {
        console.error("Failed to update activity with embedding", error);
        return null;
    }
});
exports.onActivityUpdated = (0, firestore_1.onDocumentUpdated)("activities/{activityId}", async (event) => {
    const currData = event.data?.after.data();
    if (!currData)
        return null;
    const prevData = event.data?.before.data();
    const prevContent = `${prevData.placeName || ""} ${prevData.category || ""} ${prevData.description || ""}`.trim();
    const currContent = `${currData.placeName || ""} ${currData.category || ""} ${currData.description || ""}`.trim();
    if (prevContent === currContent && currData.embeddingVector) {
        return null; // no need to update
    }
    if (!currContent) {
        return event.data?.after.ref.update({
            embeddingVector: firestore_2.FieldValue.delete()
        });
    }
    try {
        const vector = await generateVector(currContent);
        return event.data?.after.ref.update({
            embeddingVector: firestore_2.FieldValue.vector(vector)
        });
    }
    catch (error) {
        console.error("Failed to update activity with embedding", error);
        return null;
    }
});
exports.getSearchVector = (0, https_1.onCall)(async (request) => {
    const queryText = request.data?.queryText;
    if (!queryText || typeof queryText !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'The function must be called with a valid string "queryText".');
    }
    try {
        const vector = await generateVector(queryText);
        const db = admin.firestore();
        const coll = db.collection('activities');
        const vectorQuery = coll.findNearest('embeddingVector', firestore_2.FieldValue.vector(vector), {
            limit: 10,
            distanceMeasure: 'COSINE'
        });
        const snapshot = await vectorQuery.get();
        const results = snapshot.docs.map(doc => {
            const data = doc.data();
            delete data.embeddingVector;
            // Convert timestamps to primitive values for JSON transmission or send them as objects
            if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
                data.createdAtMillis = data.createdAt.toMillis();
            }
            return { id: doc.id, ...data };
        });
        return { results };
    }
    catch (error) {
        console.error("Error in getSearchVector:", error);
        throw new https_1.HttpsError('internal', 'Unable to generate search vector.');
    }
});
//# sourceMappingURL=embeddings.js.map