#!/usr/bin/env node
import { program } from "commander";
import { createRequire } from "module";
import { landoPull } from "../cli/lando-pull.js";
import { Printer } from "./../utils/logger.js";
import { readConfig } from "./../core/config.js";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

program
  .name("Lando Pull")
  .version(version)
  .description("A CLI tool for syncing remote databases and files to your local Lando environment.")
  .option("-c, --config <config>", "Path to the configuration file (default: .landorc)")
  .option("--skip-db", "Skip database")
  .option("--skip-files", "Skip files")
  .option("--auth-method <method>", "Authentication method: 'password' or 'key'")
  .option("--key-path <keyPath>", "Path to SSH private key (for key-based auth)")
  .option(
    "--password [password]",
    "Remote server password (for password auth, recommended via ENV)",
  )
  .option("-q, --quiet", "Disable output")
  .option("-v, --verbose", "Enable verbose logging")
  .action(async (options) => {
    if (options.verbose) {
      Printer.enableVerbose();
    }
    if (options.quiet) {
      Printer.enableQuiet();
    }

    if (options.skipDb && options.skipFiles) {
      Printer.error("skipping both database and files. Nothing to do!");
      process.exit(1);
    }

    const config = await readConfig(options.config);

    if (options.authMethod) {
      config.remote.authMethod = options.authMethod;
    }
    if (options.password) {
      config.remote.password = options.password || process.env.LANDO_REMOTE_PASSWORD;
    }
    if (options.keyPath) {
      config.remote.keyPath = options.keyPath;
    }
    landoPull(config, options);
  });

program.parse(process.argv);
