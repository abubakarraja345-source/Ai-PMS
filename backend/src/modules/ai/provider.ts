import {
  Content,
  FunctionCall,
  FunctionDeclaration,
  GoogleGenAI,
  Part,
} from "@google/genai";
import { env } from "../../config/env";

export type { Content, Part, FunctionCall, FunctionDeclaration };

export interface AiTurnResult {
  text: string | null;
  functionCalls: FunctionCall[];
  modelContent: Content | null;
  tokens: number | null;
}

export interface AiProvider {
  isConfigured(): boolean;
  generateTurn(
    systemInstruction: string,
    contents: Content[],
    tools: FunctionDeclaration[]
  ): Promise<AiTurnResult>;
}

/**
 * "-latest" alias rather than a dated model id — Google is actively
 * deprecating dated snapshots for new API keys (confirmed live:
 * "gemini-2.5-flash" 404s as "no longer available to new users"
 * despite still being listed by ListModels). The alias always
 * resolves to Google's current recommended flash model.
 */
export const GEMINI_MODEL = "gemini-flash-latest";

/**
 * Thin wrapper around @google/genai. Never throws for "not
 * configured" at construction time — env.geminiApiKey may
 * legitimately be empty (no key provided yet), and callers need to
 * check isConfigured() to return a clean "AI is not configured"
 * response instead of a crash.
 *
 * generateTurn is deliberately one model call, not a full
 * tool-calling loop — the caller (service.ts) owns the loop so it
 * can intercept action-proposal tool calls and stop before a second
 * round-trip, which the SDK's own "automatic function calling"
 * cannot do (it always runs every declared tool to completion).
 */
class GeminiProvider implements AiProvider {
  private client: GoogleGenAI | null;

  constructor(apiKey: string | undefined) {
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async generateTurn(
    systemInstruction: string,
    contents: Content[],
    tools: FunctionDeclaration[]
  ): Promise<AiTurnResult> {
    if (!this.client) {
      throw new Error("AI provider is not configured");
    }

    const response = await this.client.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        ...(tools.length > 0
          ? { tools: [{ functionDeclarations: tools }] }
          : {}),
      },
    });

    const candidateContent = response.candidates?.[0]?.content ?? null;

    return {
      text: response.text ?? null,
      functionCalls: response.functionCalls ?? [],
      modelContent: candidateContent,
      tokens: response.usageMetadata?.totalTokenCount ?? null,
    };
  }
}

export const aiProvider: AiProvider = new GeminiProvider(env.geminiApiKey);

/** role for a functionResponse turn — matches the SDK's own internal
 * convention for manual (non-automatic) function calling loops. */
export function functionResponseContent(parts: Part[]): Content {
  return { role: "user", parts };
}
