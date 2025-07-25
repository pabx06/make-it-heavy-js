/**
 * @file Defines the TaskOrchestrator class, which manages the multi-agent workflow.
 */
import { OpenRouterAgent } from './agent.js';
import { AppConfig, AgentResult, AgentStatus } from './types.js';
/**
 * The TaskOrchestrator coordinates multiple AI agents to perform a complex task.
 * It handles task decomposition, parallel execution, and result aggregation.
 */
export class TaskOrchestrator {
  /** The application's configuration object. */
  public readonly config: AppConfig;
  /** The number of parallel agents to use. */
  public readonly num_agents: number;
  private readonly task_timeout: number;
  private readonly aggregation_strategy: string;
  private agent_progress: Map<number, string> = new Map();
  private agent_results: Map<number, string> = new Map();
  /**
   * Creates an instance of TaskOrchestrator.
   * @param {AppConfig} config - The application configuration object.
   */
  constructor(config: AppConfig) {
    this.config = config;
    this.num_agents = this.config.orchestrator.parallel_agents;
    this.task_timeout = this.config.orchestrator.task_timeout;
    this.aggregation_strategy = this.config.orchestrator.aggregation_strategy;
  }
  /**
   * The main orchestration method.
   * Takes user input, delegates to parallel agents, and returns an aggregated result.
   * @param {string} userInput - The high-level task from the user.
   * @returns {Promise<string>} A promise that resolves to the final, synthesized answer.
   */
  public async orchestrate(userInput: string): Promise<string> {
    this.agent_progress.clear();
    this.agent_results.clear();
    this.update_agent_progress(-1, AgentStatus.INITIALIZING);
    const subtasks = await this.decompose_task(userInput, this.num_agents);
    for (let i = 0; i < this.num_agents; i++) {
        this.agent_progress.set(i, AgentStatus.QUEUED);
    }
    const agentPromises = subtasks.map((subtask, i) => {
        const taskPromise = this.run_agent_parallel(i, subtask);
        const timeoutPromise = new Promise<AgentResult>((resolve) =>
            setTimeout(() => {
                this.update_agent_progress(i, `${AgentStatus.FAILED}: Timeout`);
                resolve({
                    agent_id: i,
                    status: 'timeout',
                    response: `Agent ${i + 1} timed out after ${this.task_timeout}s`,
                    execution_time: this.task_timeout,
                });
            }, this.task_timeout * 1000)
        );
        return Promise.race([taskPromise, timeoutPromise]);
    });
    const agentResults = await Promise.all(agentPromises);
    agentResults.sort((a, b) => a.agent_id - b.agent_id);
    this.update_agent_progress(-1, AgentStatus.AGGREGATING);
    return await this.aggregate_results(agentResults);
  }
  /**
   * Gets the current progress status for all agents.
   * @returns {Map<number, string>} A map of agent IDs to their current status string.
   */
  public get_progress_status(): Map<number, string> {
    return new Map(this.agent_progress);
  }
  /**
   * Uses an AI agent to decompose a user's high-level task into smaller, parallelizable subtasks.
   * @param {string} userInput - The user's original request.
   * @param {number} numAgents - The number of subtasks to generate.
   * @returns {Promise<string[]>} A promise that resolves to an array of subtask strings.
   */
  private async decompose_task(userInput: string, numAgents: number): Promise<string[]> {
    const questionAgent = new OpenRouterAgent(true);
    const promptTemplate = this.config.orchestrator.question_generation_prompt;
    const generationPrompt = promptTemplate
        .replace('{user_input}', userInput)
        .replace('{num_agents}', String(numAgents));
    questionAgent.tools = questionAgent.tools.filter(
        tool => tool.function?.name !== 'mark_task_complete'
    );
    delete questionAgent.tool_mapping['mark_task_complete'];
    try {
        const response = await questionAgent.run(generationPrompt);
        const questions = JSON.parse(response.trim());
        if (!Array.isArray(questions) || questions.length !== numAgents) {
            throw new Error(`Expected ${numAgents} questions, but got ${questions.length}`);
        }
        return questions;
    } catch (e) {
        console.warn(`AI-based task decomposition failed: ${e}. Falling back to predefined questions.`);
        const fallbackQuestions = [
            `Research comprehensive information about: ${userInput}`,
            `Analyze and provide insights about: ${userInput}`,
            `Find alternative perspectives on: ${userInput}`,
            `Verify and cross-check facts about: ${userInput}`
        ];
        return fallbackQuestions.slice(0, numAgents);
    }
  }
  private update_agent_progress(agentId: number, status: string, result: string | null = null): void {
    this.agent_progress.set(agentId, status);
    if (result !== null) {
        this.agent_results.set(agentId, result);
    }
  }
  private async run_agent_parallel(agentId: number, subtask: string): Promise<AgentResult> {
    try {
        this.update_agent_progress(agentId, AgentStatus.PROCESSING);
        const agent = new OpenRouterAgent(true);
        const startTime = Date.now();
        const response = await agent.run(subtask);
        const executionTime = (Date.now() - startTime) / 1000;
        this.update_agent_progress(agentId, AgentStatus.COMPLETED, response);
        return { agent_id: agentId, status: "success", response, execution_time: executionTime };
    } catch (e: any) {
        const errorMessage = `Error: ${e.message}`;
        this.update_agent_progress(agentId, `${AgentStatus.FAILED}: ${e.message}`);
        return { agent_id: agentId, status: "error", response: errorMessage, execution_time: 0 };
    }
  }
  private async aggregate_results(agentResults: AgentResult[]): Promise<string> {
    const successfulResults = agentResults.filter(r => r.status === "success");
    if (successfulResults.length === 0) {
        return "All agents failed to provide results. Please try again.";
    }
    const responses = successfulResults.map(r => r.response);
    return this._aggregate_consensus(responses);
  }
  private async _aggregate_consensus(responses: string[]): Promise<string> {
    if (responses.length === 1) return responses[0];
    const synthesisAgent = new OpenRouterAgent(true);
    let agentResponsesText = "";
    responses.forEach((response, i) => {
        agentResponsesText += `=== AGENT ${i + 1} RESPONSE ===
${response}
`;
    });
    const synthesisPromptTemplate = this.config.orchestrator.synthesis_prompt;
    const synthesisPrompt = synthesisPromptTemplate
        .replace('{num_responses}', String(responses.length))
        .replace('{agent_responses}', agentResponsesText);
    synthesisAgent.tools = [];
    synthesisAgent.tool_mapping = {};
    try {
        return await synthesisAgent.run(synthesisPrompt);
    } catch (e: any) {
        console.error(`\n🚨 SYNTHESIS FAILED: ${e.message}`);
        console.log("📋 Falling back to concatenated responses\n");
        return responses.map((resp, i) => `=== Agent ${i + 1} Response ===\n${resp}`).join('\n');
    }
  }
}
