import type { LlmOutput } from "../insights/insights.schema.js";
import type { Holding, LtpData } from "../portfolio/portfolio.schema.js";
import type { StockSlConfig } from "../stopLoss/stopLoss.config.js";
import type { SlBreach } from "../stopLoss/stopLoss.detector.js";
import type { TargetHit } from "../targets/targets.detector.js";

export type AgentState = {
  runId: string;
  holdings: Holding[];
  ltpMap: Record<string, LtpData>;
  slConfigs: StockSlConfig[];
  breaches: SlBreach[];
  targetHits: TargetHit[];
  llmOutput: LlmOutput | null;
  errors: string[];
};

type NodeFunction = (state: Readonly<AgentState>) => Promise<Partial<AgentState>>;

/**
 * Lightweight sequential state graph.
 * Each node receives the full current state and returns only the fields it updates.
 */
export class StateGraph {
  private readonly nodes: Array<{ name: string; fn: NodeFunction }> = [];

  /**
   * Register a node. Nodes execute in registration order.
   * @param name - Human-readable node name for logging
   * @param fn - Async function receiving state, returning a partial update
   * @returns this (for chaining)
   */
  addNode(name: string, fn: NodeFunction): this {
    this.nodes.push({ name, fn });
    return this;
  }

  /**
   * Run all nodes in sequence, accumulating state updates.
   * @param initialState - The starting agent state
   * @returns Final state after all nodes have run
   */
  async run(initialState: AgentState): Promise<AgentState> {
    let state: AgentState = { ...initialState };
    for (const { fn } of this.nodes) {
      const update = await fn(state);
      state = { ...state, ...update };
    }
    return state;
  }
}
