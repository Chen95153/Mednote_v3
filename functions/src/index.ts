import * as functions from "firebase-functions/v1";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();

// Define the parameter to read from .env
const geminiApiKey = defineString("GEMINI_API_KEY");

export const callGeminiProxy = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    // 1. Security Check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required.");
    }

    // 2. Rate Limiting (Firestore Transaction)
    // const userRef = admin.firestore().collection("users").doc(context.auth.uid);
    // TODO: Implement actual rate limiting logic if needed

    // 3. Access Secret Key
    const apiKey = geminiApiKey.value();
    const ai = new GoogleGenAI({ apiKey });

    // 4. Call AI
    try {
        const response = await ai.models.generateContent({
            model: data.model || "gemini-1.5-flash",
            contents: data.contents,
            config: data.config
        });

        // Handle potential different response structures from the SDK
        const text = response.text || "";
        return { text };
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        throw new functions.https.HttpsError("internal", "Failed to generate content.", error.message);
    }
});
