/**
 * @file Handles the web server endpoint for receiving remote requests.
 */
import * as http from 'http';
import { TaskOrchestrator } from '../orchestrator.js';
import { OpenAIRequest, OpenAIResponse } from '../types.js';
import { randomUUID } from 'crypto';
/**
 * Manages an HTTP server to accept tasks via an OpenAI-compatible API endpoint.
 */
export class EndpointHandler {
  private orchestrator: TaskOrchestrator;
  private port: number;
  private host: string;
  /**
   * Creates an instance of EndpointHandler.
   * @param {TaskOrchestrator} orchestrator - The main task orchestrator.
   */
  constructor(orchestrator: TaskOrchestrator) {
    this.orchestrator = orchestrator;
    this.port = orchestrator.config.app.endpoint.port;
    this.host = orchestrator.config.app.endpoint.host;
  }
  /**
   * Starts the HTTP server and begins listening for requests.
   */
  public start(): void {
    const server = http.createServer(this.handleRequest.bind(this));
    server.listen(this.port, this.host, () => {
      console.log(`🚀 Server started in 'endpoint' mode.`);
      console.log(`Listening on http://${this.host}:${this.port}`);
      console.log(`Accepting POST requests at /v1/chat/completions`);
    });
  }
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Handle CORS pre-flight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      try {
        const body = await this.getRequestBody(req);
        const openAIRequest = JSON.parse(body) as OpenAIRequest;
        const userInput = this.extractUserInput(openAIRequest);
        if (!userInput) {
          this.sendError(res, 400, 'No valid user message found in request body.');
          return;
        }
        console.log(`Received task: "${userInput.substring(0, 50)}..."`);
        const result = await this.orchestrator.orchestrate(userInput);
        console.log(`Task completed. Sending response.`);
        const responsePayload = this.formatOpenAIResponse(result);
        this.sendJSON(res, 200, responsePayload);
      } catch (error: any) {
        console.error("Error processing request:", error);
        this.sendError(res, 500, `Internal Server Error: ${error.message}`);
      }
    } else {
      this.sendError(res, 404, 'Not Found. Please POST to /v1/chat/completions');
    }
  }
  private extractUserInput(request: OpenAIRequest): string | null {
    if (!request.messages || request.messages.length === 0) {
      return null;
    }
    // Get the last message with the role 'user'
    return request.messages.filter(m => m.role === 'user').pop()?.content ?? null;
  }
  private formatOpenAIResponse(content: string): OpenAIResponse {
    const model = this.orchestrator.config.openrouter.model;
    return {
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: `orchestrator(${model})`,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: content,
        },
        finish_reason: 'stop',
      }],
    };
  }
  private getRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => resolve(body));
      req.on('error', err => reject(err));
    });
  }
  private sendJSON(res: http.ServerResponse, statusCode: number, payload: any): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(payload));
  }
  private sendError(res: http.ServerResponse, statusCode: number, message: string): void {
    this.sendJSON(res, statusCode, { error: { message, type: 'invalid_request_error' } });
  }
}