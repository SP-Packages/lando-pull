import fs from 'fs';
import path from 'path';
import { PullConfig } from '../types/types.js';
import { createInterface } from 'readline';
import { Printer } from '../utils/logger.js';
import { existsSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { DEFAULT_CONFIG } from '../constants.js';
import { PullOptions } from '../types/types.js';

/**
 *
 * Get the database port from Lando info command.
 * @param options - The command line options
 * @returns The database port or null if not found
 */
function getDatabasePort(options: PullOptions): string | null {
  try {
    // Execute lando info command and capture output
    const landoInfo = execSync('lando info', { encoding: 'utf-8' });

    if (!landoInfo || landoInfo.trim() === '') {
      Printer.error('Lando info returned empty response');
      return null;
    }

    // Since we know the output isn't valid JSON, let's try to extract the port directly
    try {
      // First approach: Try to convert to valid JSON by wrapping in curly braces
      const jsonString = `{${landoInfo.replace(/'/g, '"')}}`;
      try {
        const info = JSON.parse(jsonString);
        Printer.log(`Parsed Lando info successfully`);

        // Look for the database service
        const databaseService = info.find(
          (service: { service: string }) => service.service === 'database'
        );
        if (databaseService && databaseService.external_connection) {
          const port = databaseService.external_connection.port;
          Printer.log(`Found database port: ${port}`);
          // Use the port as needed
          return port;
        }
      } catch {
        // JSON approach failed, fall back to regex extraction
        Printer.log(
          'JSON parsing failed, using regex extraction instead',
          'warning'
        );
      }

      // Second approach: Use regex to extract the port directly
      const portMatch = landoInfo.match(
        /external_connection:.*?port:\s*'(\d+)'/
      );
      if (portMatch && portMatch[1]) {
        const port = portMatch[1];
        Printer.log(`Found database port using regex: ${port}`, 'success');
        // Use the port as needed
        return port;
      }

      // Third approach: Manual search and extraction
      const externalConnIndex = landoInfo.indexOf('external_connection:');
      if (externalConnIndex !== -1) {
        const portIndex = landoInfo.indexOf('port:', externalConnIndex);
        if (portIndex !== -1) {
          // Extract the text after "port:" and before the next comma or closing bracket
          const end = landoInfo.indexOf('}', portIndex);
          if (end === -1) return null;
          const portText = landoInfo.substring(portIndex + 5, end);
          const port = portText.trim().replace(/[^0-9]/g, '');
          Printer.log(
            `Found database port using string extraction: ${port}`,
            'success'
          );
          // Use the port as needed
          return port;
        }
      }

      Printer.error('Could not find database port in lando info output');
    } catch (parseError) {
      Printer.error(`Failed to extract database port:`, parseError);

      if (options.debug) {
        Printer.log(`Raw Lando info: ${landoInfo.slice(0, 200)}`);
      }
    }
  } catch (executionError) {
    Printer.error(
      `Failed to get Lando info: ${executionError instanceof Error ? executionError.message : String(executionError)}`
    );
  }

  return null;
}

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
 * @param options - The command line options
 * @returns The configuration object
 */
export async function readConfig(options: PullOptions): Promise<PullConfig> {
  const configPath = options.config || null;
  const defaultConfigFileName = 'landorc.json';
  const possibleConfigFiles = ['.landorc', 'landorc.json', '.landorc.json'];
  let resolvedPath = configPath ? path.resolve(configPath) : null;

  // If no config path specified, try possible config files
  if (!resolvedPath) {
    for (const file of possibleConfigFiles) {
      const testPath = path.resolve(file);
      if (existsSync(testPath)) {
        resolvedPath = testPath;
        break;
      }
    }
  }

  // If still no config found, ask to create one
  if (!resolvedPath || !existsSync(resolvedPath)) {
    Printer.error('Config file not found');
    Printer.error(
      `Please create a ${defaultConfigFileName} or specify a config file with --config <path>`
    );
    const response = await askQuestion(
      `Generate a default ${defaultConfigFileName} and proceed? (y/n)`
    );
    if (response === 'y') {
      writeFileSync(defaultConfigFileName, JSON.stringify(DEFAULT_CONFIG));
      resolvedPath = path.resolve(defaultConfigFileName);
      Printer.success(
        `Default config file ${defaultConfigFileName} created successfully. Update the default configurations and run the command again.`
      );
      process.exit(1);
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

    if (
      !options.skipDb &&
      (config.local.dbPort === null || config.local.dbPort === undefined)
    ) {
      Printer.log(
        'Database port not found in config. Trying to get it from Lando info...',
        'warning'
      );
      const detectedPort = getDatabasePort(options);
      if (!detectedPort) {
        throw new Error(
          'Database port not found in config or Lando info. Please set it manually.'
        );
      }
      config.local.dbPort = Number(detectedPort);
    }

    Printer.log(
      `Configuration loaded successfully from ${resolvedPath}`,
      'success'
    );
    return config;
  } catch (error: unknown) {
    Printer.error(error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to read or parse config file: ${resolvedPath}`);
  }
}
