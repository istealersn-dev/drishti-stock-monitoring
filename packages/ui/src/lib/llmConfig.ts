// Fixed local LLM config (CLAUDE.md — "LM Studio is the primary LLM
// provider... Do NOT use OpenAI or any other cloud API"). This app has no
// BYO-provider system, so these are constants, not fetched from an endpoint —
// shared so the Ask composer's model pill and Settings' Model & runtime card
// can't drift on the same underlying fact.
export const LM_PROVIDER = "LM Studio (local)";
export const LM_MODEL = "google/gemma-4-12b-qat";
export const LM_ENDPOINT = "http://localhost:1234";
export const LM_MODEL_SHORT_LABEL = "gemma-4-12b · lm studio";
