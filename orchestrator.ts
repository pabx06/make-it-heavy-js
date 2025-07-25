import * as fs from 'fs';
import * as yaml from 'js-yaml';

// --- Placeholder Agent Class ---
// In a real project, this would be in its own file (e.g., agent.ts)
// and would make actual API calls to a service like OpenRouter.
class OpenRouterAgent {
    public tools: any[] = [{ function: { name: 'mark_task_complete' } }];
    public tool_mapping: Record<string, Function> = {
        mark_task_complete: () => {}
    };

    constructor(private silent: boolean = false) {}

    async run(prompt: string): Promise<string> {
        // Simulate an API call delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

        // Simulate different responses based on the prompt
        if (prompt.includes("generate a list of questions")) {
            return JSON.stringify([
                "Analyze the historical context of the user's query.",
                "Evaluate the primary arguments and counter-arguments related to the topic.",
                "Summarize the future implications and expert predictions.",
                "Identify key figures and their contributions to the subject."
            ]);
        } else if (prompt.includes("Synthesize the following agent responses")) {
            return `This is a synthesized summary of all agent findings. The topic is complex, but a consensus points towards a positive future outlook, considering historical precedents and expert analysis.`;
        } else {
            return `This is a detailed analysis for the subtask: "${prompt.substring(0, 50)}...".`;
        }
    }
}


// --- Type Definitions ---

interface OpenRouterConfig {
    model: string;
    api_key: string;
}

interface OrchestratorConfig {
    parallel_agents: number;
    task_timeout: number;
    aggregation_strategy: 'consensus';
    question_generation_prompt: string;
    synthesis_prompt: string;
}

interface AppConfig {
    openrouter: OpenRouterConfig;
    orchestrator: OrchestratorConfig;
}

export interface AgentResult {
    agent_id: number;
    status: 'success' | 'error' | 'timeout';
    response: string;
    execution_time: number;
}

// --- TaskOrchestrator Class ---

export class TaskOrchestrator {
    public readonly config: AppConfig;
    public readonly num_agents: number;
    private readonly task_timeout: number;
    private readonly aggregation_strategy: string;

    private agent_progress: Map<number, string> = new Map();
    private agent_results: Map<number, string> = new Map();

    constructor(configPath: string = "config.yaml") {
        try {
            const fileContents = fs.readFileSync(configPath, 'utf8');
            this.config = yaml.load(fileContents) as AppConfig;
        } catch (e) {
            console.error("Error loading or parsing config.yaml:", e);
            throw new Error("Could not load configuration.");
        }

        this.num_agents = this.config.orchestrator.parallel_agents;
        this.task_timeout = this.config.orchestrator.task_timeout;
        this.aggregation_strategy = this.config.orchestrator.aggregation_strategy;
    }

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
            this.update_agent_progress(agentId, "PROCESSING...");
            const agent = new OpenRouterAgent(true);
            const startTime = Date.now();

            const response = await agent.run(subtask);

            const executionTime = (Date.now() - startTime) / 1000;
            this.update_agent_progress(agentId, "COMPLETED", response);

            return {
                agent_id: agentId,
                status: "success",
                response: response,
                execution_time: executionTime
            };
        } catch (e: any) {
            const errorMessage = `Error: ${e.message}`;
            this.update_agent_progress(agentId, `FAILED: ${e.message}`);
            return {
                agent_id: agentId,
                status: "error",
                response: errorMessage,
                execution_time: 0
            };
        }
    }

    private async aggregate_results(agentResults: AgentResult[]): Promise<string> {
        const successfulResults = agentResults.filter(r => r.status === "success");

        if (successfulResults.length === 0) {
            return "All agents failed to provide results. Please try again.";
        }

        const responses = successfulResults.map(r => r.response);

        if (this.aggregation_strategy === "consensus") {
            return this._aggregate_consensus(responses);
        } else {
            return this._aggregate_consensus(responses); // Default to consensus
        }
    }

    private async _aggregate_consensus(responses: string[]): Promise<string> {
        if (responses.length === 1) {
            return responses[0];
        }

        const synthesisAgent = new OpenRouterAgent(true);
        let agentResponsesText = "";
        responses.forEach((response, i) => {
            agentResponsesText += `=== AGENT ${i + 1} RESPONSE ===\n${response}\n\n`;
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
            return responses.map((resp, i) => `=== Agent ${i + 1} Response ===\n${resp}`).join('\n\n');
        }
    }

    public get_progress_status(): Map<number, string> {
        return new Map(this.agent_progress);
    }

    public async orchestrate(userInput: string): Promise<string> {
        this.agent_progress.clear();
        this.agent_results.clear();

        this.update_agent_progress(-1, "INITIALIZING...");
        const subtasks = await this.decompose_task(userInput, this.num_agents);

        for (let i = 0; i < this.num_agents; i++) {
            this.agent_progress.set(i, "QUEUED");
        }

        const agentPromises = subtasks.map((subtask, i) => {
            const taskPromise = this.run_agent_parallel(i, subtask);
            
            const timeoutPromise = new Promise<AgentResult>((resolve) =>
                setTimeout(() => {
                    this.update_agent_progress(i, "FAILED: Timeout");
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

        this.update_agent_progress(-1, "AGGREGATING...");
        return await this.aggregate_results(agentResults);
    }
}
