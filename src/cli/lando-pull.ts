import { Printer } from '../utils/logger.js';
import { Executer } from '../core/executer.js';
import { PullConfig, PullOptions } from '../types/types.js';

/**
 * Run Lando Pull
 * @param config - The pull configuration
 * @param options - The pull options
 * @returns void - Returns nothing
 */
export async function landoPull(
  config: PullConfig,
  options: PullOptions
): Promise<void> {
  Printer.log('Running Lando Pull', 'header');
  const spinner = Printer.spinner('Running pull...').start();

  try {
    const result = await Executer.quickPull(config, spinner, options);
    spinner.succeed('Pull complete!');
    Printer.log('Summary', 'subheader');
    Printer.success(`Duration: ${result.duration} seconds`);
    Printer.success('Pull completed successfully');
  } catch (error) {
    spinner.fail();
    Printer.error(`Pull failed: ${error}`);
    process.exit(1);
  }
}
