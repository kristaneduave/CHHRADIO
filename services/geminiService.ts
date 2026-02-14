import { GoogleGenAI, Type, Chat } from "@google/genai";
import { CaseData, AnalysisResult } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
export const isAIEnabled = !!apiKey && apiKey !== 'YOUR_GEMINI_API_KEY';

const aiClient = isAIEnabled ? new GoogleGenAI({ apiKey }) : null;

export async function analyzeMedicalImage(
  base64Image: string,
  caseData: CaseData
): Promise<AnalysisResult | null> {
  if (!aiClient) {
    console.warn("Gemini API Key missing. AI features disabled.");
    return null;
  }

  const contextPrompt = `
    Perform an advanced educational analysis of this medical image.
    
    Clinical Context:
    - Patient: ${caseData.initials}
    - Age/Status: ${caseData.age}yo ${caseData.isPediatric ? '(Pediatric)' : '(Adult)'}
    - Specialty: ${caseData.specialty}
    - History: ${caseData.clinicalHistory}
    - Observed Findings: ${caseData.findings}

    Instructions:
    1. Identify key radiographic findings.
    2. Provide a list of differential diagnoses with confidence scores (0-100) and brief rationale.
    3. Suggest a 3-step Plan of Care/Next Steps.
    4. Assess overall case severity (Routine, Urgent, Critical).
    5. Write a concise professional educational summary.
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/png' } },
          { text: contextPrompt }
        ]
      },
      config: {
        systemInstruction: "You are a world-class senior medical radiology consultant and educator. Provide highly structured, analytical responses in JSON format. Disclaimer: For educational purposes only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            modality: { type: Type.STRING },
            anatomy_region: { type: Type.STRING },
            keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
            differentials: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  condition: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  rationale: { type: Type.STRING }
                },
                required: ["condition", "confidence", "rationale"]
              }
            },
            planOfCare: { type: Type.ARRAY, items: { type: Type.STRING } },
            educationalSummary: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ["Routine", "Urgent", "Critical"] },
            teachingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            pearl: { type: Type.STRING },
            redFlags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["modality", "anatomy_region", "keyFindings", "differentials", "planOfCare", "educationalSummary", "severity", "teachingPoints", "pearl", "redFlags"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
}

export async function generateMedicalQuiz(specialty: string = 'Neurology') {
  if (!aiClient) return null;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a 3-question medical quiz about ${specialty}. Return in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: "STRING" },
              options: { type: "ARRAY", items: { type: "STRING" } },
              correctAnswer: { type: "NUMBER", description: "Index of the correct answer" }
            },
            required: ["question", "options", "correctAnswer"]
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Quiz Error:", error);
    return null;
  }
}

export function createMedicalChat(): Chat | null {
  if (!aiClient) return null;

  return aiClient.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are a Senior Medical Consultant AI. 
      Your goal is to assist medical professionals with clinical reasoning, differential diagnosis, and educational case reviews. 
      Maintain a professional, formal, and analytical tone. 
      Always structure long responses with headers and bullet points. 
      IMPORTANT: Include a short disclaimer at the bottom of major medical advice stating this is for educational simulation only.`,
    },
  });
}
