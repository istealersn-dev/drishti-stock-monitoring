import type { ChatCompletionTool } from "openai/resources/chat/completions.js";

export const webSearchToolDefinition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current news, price action, and sentiment on an Indian-listed stock. Use this whenever a specific stock is mentioned and up-to-date information would improve the answer.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The stock's trading symbol or company name, used to cache results",
        },
        query: {
          type: "string",
          description: "A focused search query, e.g. 'Reliance Industries stock news July 2026'",
        },
      },
      required: ["symbol", "query"],
    },
  },
};
