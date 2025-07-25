/**
 * @file Manages loading and validation of the application configuration.
 */
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { AppConfig } from './types.js';
/**
 * Loads, validates, and returns the application configuration from `config.yaml`.
 * Provides default values for the 'app' section if they are missing.
 * @returns {AppConfig} The fully parsed and validated application configuration.
 * @throws {Error} If `config.yaml` is not found or is invalid.
 */
export function loadConfig(): AppConfig {
  try {
    const fileContents = fs.readFileSync('config.yaml', 'utf8');
    const config = yaml.load(fileContents) as Partial<AppConfig>;
    // Provide default values for the app configuration
    const fullConfig: AppConfig = {
      app: {
        mode: config.app?.mode ?? 'cli',
        endpoint: {
          port: config.app?.endpoint?.port ?? 8080,
          host: config.app?.endpoint?.host ?? '127.0.0.1',
        },
      },
      orchestrator: config.orchestrator!,
      openrouter: config.openrouter!,
    };
    if (!fullConfig.orchestrator || !fullConfig.openrouter) {
      throw new Error("'orchestrator' or 'openrouter' section is missing in config.yaml");
    }
    return fullConfig;
  } catch (e: any) {
    console.error("Error loading or parsing config.yaml:", e.message);
    throw new Error("Could not load or validate configuration. Please ensure config.yaml exists and is correctly formatted.");
  }
}