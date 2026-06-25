import Groq from "groq-sdk";
import dotenv from "dotenv";
import { AsyncLocalStorage } from "async_hooks";

export const groqStorage = new AsyncLocalStorage<{ degradedMode?: boolean }>();

dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.warn("Warning: GROQ_API_KEY is not defined in environment variables.");
}

const groq = new Groq({ apiKey: apiKey || "" });

function extractJsonString(content: string): string {
  const firstBrace = content.indexOf("{");
  const firstBracket = content.indexOf("[");
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = content.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = content.lastIndexOf("]");
  }

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("Could not find any JSON object or array in LLM response");
  }

  return content.slice(startIdx, endIdx + 1);
}

export async function runGroqPrompt<T>(
  prompt: string,
  temperature: number = 0.3,
  maxTokens: number = 2048
): Promise<T> {
  let retries = 0;
  const maxRetries = 3;
  let delay = 1000;
  let model = "llama-3.3-70b-versatile";

  while (true) {
    try {
      console.log(`[groq] Calling Groq API with model "${model}"...`);
      const response = await groq.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from Groq");
      }

      const clean = extractJsonString(content);
      const parsed = JSON.parse(clean) as T;
      return parsed;
    } catch (error: any) {
      console.warn(`[groq] Error with model "${model}":`, error?.message || error);
      
      // If we got an error and we are on the primary model, switch to llama-3.1-8b-instant immediately
      if (model === "llama-3.3-70b-versatile") {
        console.warn(`[groq] Switching to fallback model "llama-3.1-8b-instant" due to error.`);
        model = "llama-3.1-8b-instant";
        const store = groqStorage.getStore();
        if (store) {
          store.degradedMode = true;
        }
        retries = 0;
        delay = 1000;
        continue;
      }

      retries++;
      if (retries >= maxRetries) {
        throw error;
      }
      console.warn(`Groq prompt failed (attempt ${retries}/${maxRetries}). Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}
