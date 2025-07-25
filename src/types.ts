/**
 * @file Centralized type definitions for the application.
 */
// --- Configuration Types ---
/** Defines the structure for the application's input mode and endpoint settings. */
export interface AppSettings {
  mode: 'cli' | 'endpoint';
  endpoint: {
    port: number;
    host: string;
  };
}
/** Defines the structure for OpenRouter API settings. */
export interface OpenRouterConfig {
  model: string;
  api_key: string;
}
/** Defines the structure for the orchestrator's operational settings. */
export interface OrchestratorConfig {
  parallel_agents: number;
  task_timeout: number;
  aggregation_strategy: 'consensus';
  question_generation_prompt: string;
  synthesis_prompt: string;
}
/** The root configuration object structure. */
export interface AppConfig {
  app: AppSettings;
  openrouter: OpenRouterConfig;
  orchestrator: OrchestratorConfig;
}
// --- Operational Types ---
/** Represents the result from a single agent's execution. */
export interface AgentResult {
  agent_id: number;
  status: 'success' | 'error' | 'timeout';
  response: string;
  execution_time: number;
}
/** Enumerates the possible statuses of an agent during its lifecycle. */
export enum AgentStatus {
  QUEUED = "QUEUED",
  INITIALIZING = "INITIALIZING...",
  PROCESSING = "PROCESSING...",
  COMPLETED = "COMPLETED",
  AGGREGATING = "AGGREGATING...",
  FAILED = "FAILED",
}
// --- Endpoint API Types ---
/** Represents a single message in an OpenAI-compatible request. */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
/** Defines the structure for an OpenAI-compatible chat completion request body. */
export interface OpenAIRequest {
  messages: OpenAIMessage[];
  model?: string; // Optional, as our model is fixed in the config
}
/** Defines the structure for an OpenAI-compatible chat completion response. */
export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop';
  }[];
}