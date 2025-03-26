import fs from 'fs';
import path from 'path';
import { PullConfig } from '../types/types.js';
import { createInterface } from 'readline';
import { Printer } from '../utils/logger.js';
import { existsSync, writeFileSync } from 'fs';
import { DEFAULT_CONFIG } from '../constants.js';

const JSON_INDENT_SPACES = 2;

/**
 * Asynchronously ask a question in the console.
 * @param query - The question to ask
 * @returns The user's answer
 */
function askQuestion(query: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    })
  );
}

/**
 * Read the configuration file.
 * @param configPath - Path to the configuration file
 * @returns The configuration object
 */
export async function readConfig(configPath?: string): Promise<PullConfig> {
  const defaultConfigFile = '.landorc';
  let resolvedPath = configPath
    ? path.resolve(configPath)
    : path.resolve(defaultConfigFile);

  if (!existsSync(resolvedPath)) {
    Printer.error(`Config file not found at: ${resolvedPath}`);
    Printer.error(
      `Please create a "${defaultConfigFile}" or specify a config file with --config <path>`
    );
    const response = await askQuestion(
      `Generate a default ${defaultConfigFile} and proceed? (y/n) `
    );
    if (response === 'y') {
      writeFileSync(
        defaultConfigFile,
        JSON.stringify(DEFAULT_CONFIG, null, JSON_INDENT_SPACES)
      );
      resolvedPath = path.resolve(defaultConfigFile);
    } else {
      process.exit(1);
    }
  }

  try {
    const configData = fs.readFileSync(resolvedPath, 'utf-8');
    const config = JSON.parse(configData);
    // Validate required top-level sections
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration: must be a JSON object');
    }

    if (!config.remote || typeof config.remote !== 'object') {
      throw new Error(
        "Invalid configuration: 'remote' section must be an object"
      );
    }

    if (!config.local || typeof config.local !== 'object') {
      throw new Error(
        "Invalid configuration: 'local' section must be an object"
      );
    }

    // Validate remote section required fields
    const requiredRemoteFields = {
      host: 'string',
      user: 'string',
      port: 'number',
      authMethod: ['key', 'password'],
      dbName: 'string',
      dbUser: 'string',
      dbPassword: 'string',
      remoteFiles: 'string',
      tempFolder: 'string'
    };

    const requiredLocalFields = {
      dbHost: 'string',
      dbName: 'string',
      dbUser: 'string',
      dbPassword: 'string',
      dbPort: 'number',
      localFiles: 'string',
      tempFolder: 'string'
    };

    for (const [field, type] of Object.entries(requiredRemoteFields)) {
      if (!config.remote[field]) {
        throw new Error(`Invalid configuration: 'remote.${field}' is required`);
      }

      if (Array.isArray(type)) {
        if (!type.includes(config.remote[field])) {
          throw new Error(
            `Invalid configuration: 'remote.${field}' must be one of: ${type.join(', ')}`
          );
        }
      } else if (typeof config.remote[field] !== type) {
        throw new Error(
          `Invalid configuration: 'remote.${field}' must be a ${type}`
        );
      }
    }

    for (const [field, type] of Object.entries(requiredLocalFields)) {
      if (!config.local[field]) {
        throw new Error(`Invalid configuration: 'local.${field}' is required`);
      }

      if (Array.isArray(type)) {
        if (!type.includes(config.local[field])) {
          throw new Error(
            `Invalid configuration: 'local.${field}' must be one of: ${type.join(', ')}`
          );
        }
      } else if (typeof config.local[field] !== type) {
        throw new Error(
          `Invalid configuration: 'local.${field}' must be a ${type}`
        );
      }
    }

    return config;
  } catch (error: unknown) {
    Printer.error(error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to read or parse config file: ${resolvedPath}`);
  }
}
