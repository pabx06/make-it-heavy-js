/**
 * @file Handles the interactive command-line interface (CLI) for the application.
 */
import { TaskOrchestrator } from '../orchestrator.js';
import { UI } from '../ui.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
/**
 * Manages the user interaction loop via the command line.
 */
export class CliHandler {
  private orchestrator: TaskOrchestrator;
  private ui: UI;
  private model_display: string;
  private progressInterval: NodeJS.Timeout | null = null;
  /**
   * Creates an instance of CliHandler.
   * @param {TaskOrchestrator} orchestrator - The main task orchestrator.
   */
  constructor(orchestrator: TaskOrchestrator) {
    this.orchestrator = orchestrator;
    this.ui = new UI();
    const model_full = this.orchestrator.config.openrouter.model;
    const model_name = model_full.includes('/') ? model_full.split('/').pop()! : model_full;
    const model_parts = model_name.split('-');
    const clean_name = model_parts.length >= 3 ? model_parts.slice(0, 3).join('-') : model_name;
    this.model_display = `${clean_name.toUpperCase()} HEAVY`;
  }
  /**
   * Starts the interactive CLI session.
   * @returns {Promise<void>}
   */
  public async start(): Promise<void> {
    this.ui.drawIntro(
      this.orchestrator.num_agents,
      this.orchestrator.config.openrouter.model
    );
    const rl = readline.createInterface({ input, output });
    while (true) {
      const userInput = await rl.question('\nUser: ');
      const command = userInput.trim().toLowerCase();
      if (['quit', 'exit', 'bye'].includes(command)) {
        break;
      }
      if (!userInput) {
        console.log("Please enter a question or command.");
        continue;
      }
      console.log("\nOrchestrator: Starting multi-agent analysis...\n");
      await this.runTask(userInput);
    }
    rl.close();
    console.log("\nGoodbye!");
  }
  private async runTask(userInput: string): Promise<void> {
    const startTime = Date.now();
    this.startProgressMonitor(startTime);
    try {
      const result = await this.orchestrator.orchestrate(userInput);
      this.stopProgressMonitor();
      const elapsed = (Date.now() - startTime) / 1000;
      this.ui.drawFinalResult(
        this.model_display,
        elapsed,
        this.orchestrator.num_agents,
        this.orchestrator.get_progress_status(),
        result
      );
    } catch (e: any) {
      this.stopProgressMonitor();
      this.ui.drawError(`Orchestration failed: ${e.message}`);
    }
  }
  private startProgressMonitor(startTime: number): void {
    this.progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      this.ui.drawProgress(
        this.model_display,
        elapsed,
        this.orchestrator.num_agents,
        this.orchestrator.get_progress_status()
      );
    }, 1000);
  }
  private stopProgressMonitor(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}