import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.warn("Warning: GROQ_API_KEY is not defined in environment variables.");
}

const groq = new Groq({ apiKey: apiKey || "" });

export async function runGroqPrompt<T>(
  prompt: string,
  temperature: number = 0.3,
  maxTokens: number = 2048
): Promise<T> {
  let retries = 0;
  const maxRetries = 3;
  let delay = 1000;

  while (true) {
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from Groq");
      }

      // Strip markdown backticks before JSON.parse()
      const clean = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean) as T;
      return parsed;
    } catch (error: any) {
      retries++;
      if (retries >= maxRetries) {
        throw error;
      }
      console.warn(`Groq prompt failed (attempt ${retries}/${maxRetries}). Retrying in ${delay}ms...`, error?.message || error);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}
