import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface DetectionResult {
  found: boolean;
  name?: string;
  location?: string;
  confidence?: string;
  edibility?: string;
}

export async function detectMushrooms(base64Image: string): Promise<DetectionResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image,
              },
            },
            {
              text: "Analyze this image of the forest floor. Your task is to detect mushrooms. If you find any, identify the species, its location in the frame, and a brief note on its typical edibility (always include a strong warning that this is AI and not for consumption advice). If no mushrooms are clearly visible, indicate that none were found.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            found: { type: Type.BOOLEAN },
            name: { type: Type.STRING },
            location: { type: Type.STRING },
            confidence: { type: Type.STRING },
            edibility: { type: Type.STRING },
          },
          required: ["found"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (error) {
    console.error("Detection error:", error);
    return { found: false };
  }
}
