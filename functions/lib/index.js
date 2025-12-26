"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callGeminiProxy = void 0;
const functions = require("firebase-functions/v1");
const params_1 = require("firebase-functions/params");
const admin = require("firebase-admin");
const genai_1 = require("@google/genai");
admin.initializeApp();
// Define the parameter to read from .env
const geminiApiKey = (0, params_1.defineString)("GEMINI_API_KEY");
exports.callGeminiProxy = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Login required.");
    }
    // 2. Rate Limiting (Firestore Transaction)
    // const userRef = admin.firestore().collection("users").doc(context.auth.uid);
    // TODO: Implement actual rate limiting logic if needed
    // 3. Access Secret Key
    const apiKey = geminiApiKey.value();
    const ai = new genai_1.GoogleGenAI({ apiKey });
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
    }
    catch (error) {
        console.error("Gemini API Error:", error);
        throw new functions.https.HttpsError("internal", "Failed to generate content.", error.message);
    }
});
//# sourceMappingURL=index.js.map