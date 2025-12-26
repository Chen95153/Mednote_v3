import { GoogleGenAI } from "@google/genai";
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { SYSTEM_INSTRUCTION } from '../constants';

// Central Helper for calls
const getGeminiResponse = async (params: {
  model?: string,
  contents: any,
  config?: any
}, apiKey?: string) => {
  // 1. BYOK Path
  if (apiKey && apiKey.trim().length > 30) {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: params.model || 'gemini-1.5-flash',
      contents: params.contents,
      config: params.config
    });
    // In v1.34 SDK, response.text is a property/getter
    return response.text;
  }
  // 2. Proxy Path (Free Trial)
  else {
    const callProxy = httpsCallable(functions, 'callGeminiProxy');
    const result = await callProxy({
      model: params.model || 'gemini-1.5-flash',
      contents: params.contents,
      config: params.config
    });
    const data = result.data as { text: string };
    return data.text;
  }
};

const getErrorMessage = (error: any): string => {
  const errorMsg = error.message || error.toString();
  if (errorMsg.includes('400') || errorMsg.includes('403') || errorMsg.toLowerCase().includes('api key')) {
    return "Error: Invalid API Key or Quota Limit.";
  }
  return `Error: ${errorMsg}`;
};

export const generateAdmissionNote = async (data: any, apiKey: string): Promise<string> => {
  try {
    const responseText = await getGeminiResponse({
      model: 'gemini-1.5-flash', // Switched to stable model
      contents: JSON.stringify(data),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
      }
    }, apiKey);

    return responseText || "Error: No response generated.";
  } catch (error) {
    console.error("Error generating note:", error);
    return getErrorMessage(error);
  }
};

export const refineFullNote = async (
  originalData: any,
  currentNote: string,
  instruction: string,
  apiKey: string
): Promise<string> => {
  const refinePrompt = `
    You are a medical scribe assistant. 
    ORIGINAL DATA SOURCE (JSON): ${JSON.stringify(originalData)}
    
    CURRENT MEDICAL NOTE DRAFT:
    """
    ${currentNote}
    """
    
    USER REFINEMENT INSTRUCTION:
    "${instruction}"
    
    CRITICAL RULES:
    1. PRIORITY: Adhere to user instructions while maintaining the facts in the ORIGINAL DATA SOURCE.
    2. CONSISTENCY: Maintain all formatting rules (Vitals order, "denied" list, etc.) from the system instructions.
    3. OUTPUT: Provide ONLY the full updated medical note. No conversational filler.
  `;

  try {
    const responseText = await getGeminiResponse({
      model: 'gemini-1.5-flash',
      contents: refinePrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4,
      }
    }, apiKey);

    return responseText || currentNote;
  } catch (error) {
    console.error("Error refining full note:", error);
    return getErrorMessage(error);
  }
};

export const refineNoteSegment = async (
  originalData: any,
  fullNote: string,
  selectedSegment: string,
  instruction: string,
  apiKey: string
): Promise<string> => {
  const refinePrompt = `
    You are a medical scribe assistant. 
    ORIGINAL DATA SOURCE (JSON): ${JSON.stringify(originalData)}
    
    CURRENT FULL NOTE:
    """
    ${fullNote}
    """
    
    The user wants to rewrite the following SPECIFIC SEGMENT:
    "--- ${selectedSegment} ---"
    
    USER INSTRUCTION FOR THIS SEGMENT:
    "${instruction}"
    
    CRITICAL RULES:
    1. PRIORITY: User instructions are the highest priority. If the user asks to change the format or tone for this segment, follow it exactly.
    2. MEDICAL STANDARDS: Unless the user explicitly asks to break medical conventions, maintain the standards defined in the original system instructions (e.g., Vitals order, forbidden abbreviations, academic tone).
    3. SCOPE: ONLY rewrite the selected segment. Do not change parts of the note outside of this segment.
    4. OUTPUT: Provide ONLY the new rewritten text for that segment. Do not include any explanations or conversational filler.
  `;

  try {
    const responseText = await getGeminiResponse({
      model: 'gemini-1.5-flash',
      contents: refinePrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4,
      }
    }, apiKey);

    return responseText?.trim() || selectedSegment;
  } catch (error) {
    console.error("Error refining segment:", error);
    return getErrorMessage(error);
  }
};
