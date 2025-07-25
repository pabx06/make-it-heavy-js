/**
 * @file Main entry point for the application.
 * It loads the configuration and starts the appropriate handler (CLI or Endpoint).
 */
import { loadConfig } from './config.js';
import { TaskOrchestrator } from './orchestrator.js';
import { CliHandler } from './handlers/cli_handler.js';
import { EndpointHandler } from './handlers/endpoint_handler.js';
/**
 * The main function that initializes and runs the application.
 */
async function main() {
  try {
    const config = loadConfig();
    const orchestrator = new TaskOrchestrator(config);
    if (config.app.mode === 'endpoint') {
      const handler = new EndpointHandler(orchestrator);
      handler.start();
    } else {
      const handler = new CliHandler(orchestrator);
      await handler.start();
    }
  } catch (error: any) {
    console.error(`\n 🚨 A critical error occurred: ${error.message}`);
    process.exit(1);
  }
}
// Start the application
main();