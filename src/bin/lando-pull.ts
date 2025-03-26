#!/usr/bin/env node
import { program } from 'commander';
import { createRequire } from 'module';
import { landoPull } from '../cli/lando-pull.js';
import { Printer } from './../utils/logger.js';
import { readConfig } from './../core/config.js';
import { PullConfig } from '../types/types.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

/**
 * The main program.
 */
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
  .option('-d, --debug', 'Debug mode')
  .option('-q, --quiet', 'Disable output')
  .option('-v, --verbose', 'Enable verbose logging')
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
  .action(async (options) => {
    if (options.verbose || options.debug) {
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

      if (options.authMethod) {
        if (!['password', 'key'].includes(options.authMethod)) {
          Printer.error(
            `Invalid authentication method: ${options.authMethod}. Must be "password" or "key".`
          );
          process.exit(1);
        }
        config.remote.authMethod = options.authMethod;
      }

      if (
        config.remote.authMethod === 'password' &&
        typeof config.remote.password !== 'string'
      ) {
        throw new Error(
          'Password authentication method selected but no password provided'
        );
      }

      if (
        config.remote.authMethod === 'key' &&
        typeof config.remote.keyPath !== 'string'
      ) {
        throw new Error(
          'Key authentication method selected but no key path provided'
        );
      }

      if (options.keyPath) {
        config.remote.keyPath = options.keyPath;
      }
      if (options.password !== undefined) {
        const envPassword = process.env.LANDO_REMOTE_PASSWORD;
        config.remote.password =
          options.password === true ? envPassword || '' : options.password;

        if (options.password === true && !envPassword) {
          Printer.warning(
            'LANDO_REMOTE_PASSWORD environment variable is not set'
          );
        }
      }

      landoPull(config, options);
    } catch (error) {
      Printer.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse(process.argv);
