import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
});

export async function POST(req: Request) {
    try {
        const { image } = await req.json();

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        // Clean base64 string
        const base64Data = image.split(",")[1] || image;
        const mimeType = image.includes("data:") 
            ? image.split(";")[0].split(":")[1] 
            : "image/jpeg";

        const prompt = `You are a receipt scanning assistant. 
Analyze the provided receipt image and extract the following information in a JSON format:
{
  "amount": number (the grand total),
  "description": string (name of the store or a short summary),
  "date": string (ISO format if visible, otherwise today's date),
  "category": "Food" | "Travel" | "Shopping" | "Entertainment" | "Utilities" | "Transport" | "Rent" | "Medical" | "Insurance" | "Others",
  "items": [{"name": string, "price": number, "qty": number}]
}
Only return the raw JSON object. No markdown, no backticks.
If a value is not found, use a sensible default.
The amount should be the final total including tax.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: mimeType,
                            },
                        },
                    ],
                },
            ],
        });

        const text = response.text || "";

        // Extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return NextResponse.json(parsed);
        }

        return NextResponse.json(
            { error: "Could not parse receipt data from AI response" },
            { status: 500 }
        );
    } catch (error: any) {
        console.error("Gemini Scan Error:", error?.message || error);
        return NextResponse.json(
            { error: error?.message || "Unknown scan error" },
            { status: 500 }
        );
    }
}
