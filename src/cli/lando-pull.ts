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
    spinner.clear();
    Printer.log('Summary', 'subheader');

    if (
      (options.skipDb || result.dbSuccess) &&
      (options.skipFiles || result.filesSuccess)
    ) {
      Printer.success(`Duration: ${result.duration} seconds`);
      Printer.success('Pull completed successfully');
    } else if (result.dbSuccess || result.filesSuccess) {
      Printer.warning(`Duration: ${result.duration} seconds`);
      Printer.warning('Pull completed with some errors');
    } else {
      Printer.error(`Duration: ${result.duration} seconds`);
      Printer.error('Pull failed completely', 'error');
    }
  } catch (error) {
    spinner.clear();
    Printer.error(`Pull failed: ${error}`);
    process.exit(1);
  }
}
