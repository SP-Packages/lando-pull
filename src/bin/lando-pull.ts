#!/usr/bin/env node
import { program } from 'commander';
import { createRequire } from 'module';
import { landoPull } from '../cli/lando-pull.js';
import { Printer } from './../utils/logger.js';
import { readConfig } from './../core/config.js';
import { PullConfig } from '../types/types.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

program
  .name('Lando Pull')
  .version(version)
  .description(
    'A CLI tool for syncing remote databases and files to your local Lando environment.'
  )
  .option(
    '-c, --config <config>',
    'Path to the configuration file (default: .landorc)'
  )
  .option('--skip-db', 'Skip database')
  .option('--skip-files', 'Skip files')
  .option(
    '--auth-method <method>',
    "Authentication method: 'password' or 'key'"
  )
  .option(
    '--key-path <keyPath>',
    'Path to SSH private key (for key-based auth)'
  )
  .option(
    '--password [password]',
    'Remote server password (for password auth, recommended via ENV)'
  )
  .option('-q, --quiet', 'Disable output')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    if (options.verbose) {
      Printer.enableVerbose();
    }
    if (options.quiet) {
      Printer.enableQuiet();
    }

    if (options.skipDb && options.skipFiles) {
      Printer.error('skipping both database and files. Nothing to do!');
      process.exit(1);
    }

    let config: PullConfig;
    try {
      config = await readConfig(options.config);
    } catch (error) {
      Printer.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    if (options.authMethod) {
      if (!['password', 'key'].includes(options.authMethod)) {
        Printer.error(
          `Invalid authentication method: ${options.authMethod}. Must be "password" or "key".`
        );
        process.exit(1);
      }
      config.remote.authMethod = options.authMethod;
    }
    if (options.password !== undefined) {
      config.remote.password =
        options.password === true
          ? process.env.LANDO_REMOTE_PASSWORD
          : options.password;
    }
    if (options.keyPath) {
      config.remote.keyPath = options.keyPath;
    }

    // Validate authentication configuration
    if (config.remote.authMethod === 'password' && !config.remote.password) {
      Printer.error(
        'Password authentication method selected but no password provided.'
      );
      process.exit(1);
    }
    if (config.remote.authMethod === 'key' && !config.remote.keyPath) {
      Printer.error(
        'Key authentication method selected but no key path provided.'
      );
      process.exit(1);
    }
    landoPull(config, options);
  });

program.parse(process.argv);
