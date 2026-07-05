import { GET_BUSINESS_DATA_TOOL } from "./getBusinessData.js";
import { SEARCH_DOCUMENTS_TOOL } from "./searchDocuments.js";

export const AGENT_TOOLS_OPENAI = [GET_BUSINESS_DATA_TOOL, SEARCH_DOCUMENTS_TOOL];

/**
 * Convert OpenAI-style function tool to Gemini functionDeclaration.
 * @param {{ type: string, function: { name: string, description: string, parameters: object } }} tool
 */
export function toGeminiFunctionDeclaration(tool) {
  const fn = tool.function;
  return {
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters,
  };
}

export const AGENT_TOOLS_GEMINI = AGENT_TOOLS_OPENAI.map(toGeminiFunctionDeclaration);

export const ALLOWED_TOOL_NAMES = new Set(["getBusinessData", "searchDocuments"]);
