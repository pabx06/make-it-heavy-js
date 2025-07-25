import { TaskOrchestrator } from './orchestrator.js';
import * as readline from 'readline';
import chalk from 'chalk';

class OrchestratorCLI {
    private orchestrator: TaskOrchestrator;
    private model_display: string;
    private start_time: number | null = null;
    private running: boolean = false;
    private progressInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.orchestrator = new TaskOrchestrator();

        const model_full = this.orchestrator.config.openrouter.model;
        const model_name = model_full.includes('/') ? model_full.split('/').pop()! : model_full;
        const model_parts = model_name.split('-');
        const clean_name = model_parts.length >= 3 ? model_parts.slice(0, 3).join('-') : model_name;
        this.model_display = `${clean_name.toUpperCase()} HEAVY`;
    }

    private clear_screen(): void {
        process.stdout.write('\x1B[2J\x1B[0;0H');
    }

    private format_time(seconds: number): string {
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

    private create_progress_bar(status: string): string {
        const barLength = 70;
        const orange = chalk.hex('#FFA500');
        
        switch (status) {
            case "QUEUED":
                return "○ " + "·".repeat(barLength);
            case "INITIALIZING...":
                return `${orange('◐')} ` + "·".repeat(barLength);
            case "PROCESSING...":
                const processingBar = orange(':'.repeat(10)) + "·".repeat(barLength - 10);
                return `${orange('●')} ` + processingBar;
            case "COMPLETED":
                return `${orange('●')} ` + orange(':'.repeat(barLength));
            default:
                if (status.startsWith("FAILED")) {
                    return `${chalk.red('✗')} ` + chalk.red('×'.repeat(barLength));
                }
                return `${orange('◐')} ` + "·".repeat(barLength);
        }
    }

    private update_display(): void {
        if (!this.running) return;

        const elapsed = this.start_time ? (Date.now() - this.start_time) / 1000 : 0;
        const time_str = this.format_time(elapsed);
        const progress = this.orchestrator.get_progress_status();

        this.clear_screen();

        let output = '';
        output += `${this.model_display}\n`;
        output += `● RUNNING • ${time_str}\n\n`;

        for (let i = 0; i < this.orchestrator.num_agents; i++) {
            const status = progress.get(i) || "QUEUED";
            const progressBar = this.create_progress_bar(status);
            output += `AGENT ${String(i + 1).padStart(2, '0')}  ${progressBar}\n`;
        }
        
        process.stdout.write(output + '\n');
    }
    
    private progress_monitor = (): void => {
        this.update_display();
    }

    public async run_task(userInput: string): Promise<string | null> {
        this.start_time = Date.now();
        this.running = true;
        this.progressInterval = setInterval(this.progress_monitor, 1000);

        try {
            const result = await this.orchestrator.orchestrate(userInput);
            
            this.running = false;
            if (this.progressInterval) clearInterval(this.progressInterval);
            
            this.clear_screen();
            const elapsed = this.start_time ? (Date.now() - this.start_time) / 1000 : 0;
            const time_str = this.format_time(elapsed);
            console.log(this.model_display);
            console.log(`● COMPLETED • ${time_str}\n`);
            for (let i = 0; i < this.orchestrator.num_agents; i++) {
                const status = this.orchestrator.get_progress_status().get(i) || "COMPLETED";
                const progressBar = this.create_progress_bar(status);
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

            return result;
        } catch (e: any) {
            this.running = false;
            if (this.progressInterval) clearInterval(this.progressInterval);
            console.error(`\nError during orchestration: ${e.message}`);
            return null;
        }
    }

    public async interactive_mode(): Promise<void> {
        console.log("Multi-Agent Orchestrator (TypeScript Version)");
        try {
            const orchestratorConfig = this.orchestrator.config.openrouter;
            console.log(`Configured for ${this.orchestrator.num_agents} parallel agents`);
            console.log(`Using model: ${orchestratorConfig.model}`);
            console.log("Orchestrator initialized successfully!");
            console.log(chalk.yellow("Note: Make sure to set your OpenRouter API key in config.yaml"));
        } catch (e: any) {
            console.error(chalk.red(`Error initializing orchestrator: ${e.message}`));
            console.log("Make sure you have:");
            console.log("1. A valid 'config.yaml' file in the root directory.");
            console.log("2. Installed all dependencies with: npm install");
            return;
        }
        console.log("Type 'quit', 'exit', or 'bye' to exit");
        console.log("-".repeat(50));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '\nUser: '
        });

        rl.prompt();

        rl.on('line', async (line) => {
            const userInput = line.trim();
            if (['quit', 'exit', 'bye'].includes(userInput.toLowerCase())) {
                rl.close();
                return;
            }

            if (!userInput) {
                console.log("Please enter a question or command.");
                rl.prompt();
                return;
            }

            console.log("\nOrchestrator: Starting multi-agent analysis...\n");
            
            const result = await this.run_task(userInput);
            if (result === null) {
                console.log("Task failed. Please try again.");
            }

            rl.prompt();
        }).on('close', () => {
            console.log("\nGoodbye!");
            process.exit(0);
        });
    }
}

function main() {
    const cli = new OrchestratorCLI();
    cli.interactive_mode();
}

main();