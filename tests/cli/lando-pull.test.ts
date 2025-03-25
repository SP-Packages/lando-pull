import { describe, it, expect, vi } from 'vitest';
import { landoPull } from '../../src/cli/lando-pull.js';
import { Printer } from '../../src/utils/logger';
import { Executer } from '../../src/core/executer';
import { PullConfig, PullOptions } from '../../src/types/types';

vi.mock('../../src/utils/logger');
vi.mock('../../src/core/executer');

describe('landoPull Function', () => {
  const mockConfig: PullConfig = {
    remote: {
      host: '',
      user: '',
      port: 0,
      authMethod: 'password',
      dbName: '',
      dbUser: '',
      dbPassword: '',
      remoteFiles: ''
    },
    local: {
      dbName: '',
      dbUser: '',
      dbPassword: '',
      localFiles: '',
      dbHost: '',
      dbPort: 0
    }
  };
  const mockOptions: PullOptions = {
    skipDb: false,
    skipFiles: false,
    password: 'test-password',
    keyPath: '/path/to/key',
    verbose: true,
    quiet: false
  };

  it('should log success messages on successful pull', async () => {
    const mockResult = { success: true, duration: 120 };
    vi.mocked(Executer.quickPull).mockResolvedValue(mockResult);

    await landoPull(mockConfig, mockOptions);

    expect(Printer.log).toHaveBeenCalledWith('Running Lando Pull', 'header');
    expect(Printer.log).toHaveBeenCalledWith('Summary', 'subheader');
    expect(Printer.success).toHaveBeenCalledWith(
      `Duration: ${mockResult.duration} seconds`
    );
    expect(Printer.success).toHaveBeenCalledWith('Pull completed successfully');
  });

  it('should log error message and exit on failed pull', async () => {
    const mockError = new Error('Network error');
    vi.mocked(Executer.quickPull).mockRejectedValue(mockError);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    try {
      await landoPull(mockConfig, mockOptions);
    } catch (error) {
      expect(error.message).toBe('process.exit called');
    }

    expect(Printer.error).toHaveBeenCalledWith(`Pull failed: ${mockError}`);
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});
