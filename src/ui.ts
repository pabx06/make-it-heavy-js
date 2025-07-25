/**
 * @file Defines the UI class for handling all console output.
 */
import chalk from 'chalk';
import { AgentStatus } from './types.js';
/**
 * Manages all user interface rendering to the console.
 */
export class UI {
    private readonly barLength = 70;
    private readonly orange = chalk.hex('#FFA500');
    /** Clears the console screen. */
    public clearScreen(): void {
        process.stdout.write('\x1B[2J\x1B[0;0H');
    }
    /**
     * Formats a duration in seconds into a human-readable string (e.g., 1M30S).
     * @param {number} seconds - The duration in seconds.
     * @returns {string} The formatted time string.
     */
    public formatTime(seconds: number): string {
        if (seconds < 60) {
            return `${Math.floor(seconds)}S`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${minutes}M${secs}S`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}H${minutes}M`;
        }
    }
    /**
     * Draws the introductory message for the CLI mode.
     * @param {number} numAgents - The number of configured agents.
     * @param {string} model - The name of the AI model being used.
     */
    public drawIntro(numAgents: number, model: string): void {
        console.log("Multi-Agent Orchestrator (TypeScript Version)");
        console.log(`Configured for ${numAgents} parallel agents`);
        console.log(`Using model: ${model}`);
        console.log(chalk.yellow("Note: Make sure to set your OpenRouter API key in config.yaml"));
        console.log("Type 'quit', 'exit', or 'bye' to exit");
        console.log("-".repeat(50));
    }
    /**
     * Draws an error message to the console.
     * @param {string} message - The error message to display.
     */
    public drawError(message: string): void {
        console.error(chalk.red(`Error: ${message}`));
    }
    /**
     * Draws the live progress of all agents to the console.
     * @param {string} modelDisplay - The formatted model name for the header.
     * @param {number} elapsedSeconds - The total elapsed time in seconds.
     * @param {number} numAgents - The total number of agents.
     * @param {Map<number, string>} progress - A map of agent IDs to their current status.
     */
    public drawProgress(
        modelDisplay: string,
        elapsedSeconds: number,
        numAgents: number,
        progress: Map<number, string>
    ): void {
        this.clearScreen();
        let output = '';
        output += `${modelDisplay}
`;
        output += `● RUNNING • ${this.formatTime(elapsedSeconds)}
`;
        for (let i = 0; i < numAgents; i++) {
            const status = progress.get(i) || AgentStatus.QUEUED;
            const progressBar = this.createProgressBar(status);
            output += `AGENT ${String(i + 1).padStart(2, '0')}  ${progressBar}
`;
        }
        process.stdout.write(output);
    }
    /**
     * Draws the final results screen after a task is completed.
     * @param {string} modelDisplay - The formatted model name for the header.
     * @param {number} elapsedSeconds - The total elapsed time in seconds.
     * @param {number} numAgents - The total number of agents.
     * @param {Map<number, string>} progress - A map of agent IDs to their final status.
     * @param {string} result - The final, aggregated result from the orchestrator.
     */
    public drawFinalResult(
        modelDisplay: string,
        elapsedSeconds: number,
        numAgents: number,
        progress: Map<number, string>,
        result: string
    ): void {
        this.clearScreen();
        console.log(modelDisplay);
        console.log(`● COMPLETED • ${this.formatTime(elapsedSeconds)}
`);
        for (let i = 0; i < numAgents; i++) {
            const status = progress.get(i) || AgentStatus.COMPLETED;
            const progressBar = this.createProgressBar(status);
            console.log(`AGENT ${String(i + 1).padStart(2, '0')}  ${progressBar}`);
        }
        console.log();
        console.log("=".repeat(80));
        console.log("FINAL RESULTS");
        console.log("=".repeat(80));
        console.log();
        console.log(result);
        console.log();
        console.log("=".repeat(80));
    }
    private createProgressBar(status: string): string {
        switch (status) {
            case AgentStatus.QUEUED:
                return "○ " + "·".repeat(this.barLength);
            case AgentStatus.INITIALIZING:
                return `${this.orange('◐')} ` + "·".repeat(this.barLength);
            case AgentStatus.PROCESSING:
                const processingBar = this.orange(':'.repeat(10)) + "·".repeat(this.barLength - 10);
                return `${this.orange('●')} ` + processingBar;
            case AgentStatus.COMPLETED:
                return `${this.orange('●')} ` + this.orange(':'.repeat(this.barLength));
            default:
                if (status.startsWith(AgentStatus.FAILED)) {
                    return `${chalk.red('✗')} ` + chalk.red('×'.repeat(this.barLength));
                }
                return `${this.orange('◐')} ` + "·".repeat(this.barLength);
        }
    }
}