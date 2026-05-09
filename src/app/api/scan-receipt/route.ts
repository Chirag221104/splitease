import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
});

const openai = process.env.OPENAI_API_KEY 
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

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
  "date": string (MUST include both date AND time if visible on the receipt. Use format "YYYY-MM-DDTHH:mm:ss". For example if the receipt shows "18/10/18" and "22:45", return "2018-10-18T22:45:00". If no time is visible, use "12:00:00" as default time.),
  "category": "Food" | "Travel" | "Shopping" | "Entertainment" | "Utilities" | "Transport" | "Rent" | "Medical" | "Insurance" | "Others",
  "items": [{"name": string, "price": number, "qty": number}]
}
Only return the raw JSON object. No markdown, no backticks.
If a value is not found, use a sensible default.
The amount should be the final total including tax.
IMPORTANT: Look carefully for the TIME on the receipt (often near the date). Include it in the date field.`;

        // 1. TRY GEMINI FIRST
        try {
            console.log("Attempting scan with Gemini...");
            const response = await genAI.models.generateContent({
                model: "gemini-1.5-flash",
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

            if (response && response.text) {
                const jsonMatch = response.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return NextResponse.json(parsed);
                }
            }
            throw new Error("Gemini returned invalid or empty response");
        } catch (geminiError: any) {
            console.error("Gemini Scan Failed:", geminiError.message || geminiError);

            // 2. FALLBACK TO OPENAI IF AVAILABLE
            if (openai) {
                console.log("Gemini failed or rate limited. Falling back to OpenAI ChatGPT...");
                try {
                    const chatCompletion = await openai.chat.completions.create({
                        model: "gpt-4o", // Using the latest vision-capable model
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: prompt },
                                    {
                                        type: "image_url",
                                        image_url: {
                                            url: image.startsWith("data:") ? image : `data:${mimeType};base64,${base64Data}`,
                                        },
                                    },
                                ],
                            },
                        ],
                    });

                    const text = chatCompletion.choices[0].message.content || "";
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        return NextResponse.json(parsed);
                    }
                    throw new Error("OpenAI returned invalid response format");
                } catch (openaiError: any) {
                    console.error("OpenAI Fallback Failed:", openaiError.message || openaiError);
                    throw new Error(`Both AI models failed. Gemini: ${geminiError.message}. OpenAI: ${openaiError.message}`);
                }
            }

            // If no OpenAI key, handle the Gemini error specifically
            let message = geminiError?.message || "An unexpected error occurred while scanning.";
            let status = 500;

            if (message.includes("429") || message.toLowerCase().includes("quota")) {
                message = "Gemini Rate Limit Exceeded (Free Tier). Add an OpenAI API key for automatic failover.";
                status = 429;
            } else if (message.includes("400")) {
                message = "The image might be too large or in an unsupported format.";
                status = 400;
            }

            return NextResponse.json({ error: message }, { status });
        }
    } catch (error: any) {
        console.error("Critical Scan Error:", error);
        return NextResponse.json(
            { error: error?.message || "Unknown scan error" },
            { status: 500 }
        );
    }
}
