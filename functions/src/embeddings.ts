import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import * as admin from 'firebase-admin';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

if (!admin.apps.length) {
    admin.initializeApp();
}

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});

const embeddingModel = 'googleai/gemini-embedding-001';

interface ActivityData {
  placeName?: string;
  category?: string;
  description?: string;
  embeddingVector?: any;
}

async function generateVector(text: string): Promise<number[]> {
  try {
    const embeddingResponse = await ai.embed({
      embedder: embeddingModel,
      content: text,
    });
    return embeddingResponse[0].embedding.slice(0, 768);
  } catch (error) {
    console.error("Error generating vector:", error);
    throw error;
  }
}

export const onActivityCreated = onDocumentCreated("activities/{activityId}", async (event) => {
  const snap = event.data;
  if (!snap) return null;

  const data = snap.data() as ActivityData;
  const content = `${data.placeName || ""} ${data.category || ""} ${data.description || ""}`.trim();
  
  if (!content) return null;

  try {
    const vector = await generateVector(content);
    return snap.ref.update({
      embeddingVector: FieldValue.vector(vector)
    });
  } catch (error) {
    console.error("Failed to update activity with embedding", error);
    return null;
  }
});

export const onActivityUpdated = onDocumentUpdated("activities/{activityId}", async (event) => {
  const currData = event.data?.after.data() as ActivityData;

  if (!currData) return null;

  const prevData = event.data?.before.data() as ActivityData;
  const prevContent = `${prevData.placeName || ""} ${prevData.category || ""} ${prevData.description || ""}`.trim();
  const currContent = `${currData.placeName || ""} ${currData.category || ""} ${currData.description || ""}`.trim();

  if (prevContent === currContent && currData.embeddingVector) {
    return null; // no need to update
  }

  if (!currContent) {
    return event.data?.after.ref.update({
      embeddingVector: FieldValue.delete()
    });
  }

  try {
    const vector = await generateVector(currContent);
    return event.data?.after.ref.update({
      embeddingVector: FieldValue.vector(vector)
    });
  } catch (error) {
    console.error("Failed to update activity with embedding", error);
    return null;
  }
});

export const getSearchVector = onCall(async (request) => {
  const queryText = request.data?.queryText;
  if (!queryText || typeof queryText !== 'string') {
    throw new HttpsError('invalid-argument', 'The function must be called with a valid string "queryText".');
  }

  try {
    const vector = await generateVector(queryText);
    
    const db = admin.firestore();
    const coll = db.collection('activities');
    const vectorQuery = coll.findNearest('embeddingVector', FieldValue.vector(vector), {
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
  } catch (error) {
    console.error("Error in getSearchVector:", error);
    throw new HttpsError('internal', 'Unable to generate search vector.');
  }
});
