import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export const scanReceipt = async (base64Image: string) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Clean base64 string
        const data = base64Image.split(",")[1] || base64Image;
        const mimeType = base64Image.split(";")[0].split(":")[1] || "image/jpeg";

        const prompt = `You are a receipt scanning assistant. 
        Analyze the provided receipt image and extract the following information in a JSON format:
        {
          "amount": number,
          "description": string,
          "date": string (ISO format if possible),
          "category": "Food" | "Travel" | "Shopping" | "Entertainment" | "Utilities" | "Transport" | "Rent" | "Medical" | "Insurance" | "Others"
        }
        Only return the JSON. If a value is not found, use a sensible default. The description should be the name of the store or service.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data,
                    mimeType
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();
        
        // Clean the text to handle potential markdown formatting in response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        throw new Error("Could not parse receipt data");
    } catch (error) {
        console.error("Gemini Scan Error:", error);
        throw error;
    }
};
