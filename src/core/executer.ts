import fs from 'fs-extra';
import path from 'path';
import mysql from 'mysql2';
import { execSync, spawn } from 'child_process';
import { Ora, Printer } from '@sp-packages/printer';
import { PullConfig, PullOptions, SqlCondition } from './../types/types.js';

export class Executer {
  private config: PullConfig;

  /**
   * Default units for the executer class.
   */
  private static readonly UNITS = {
    IMPORT_RETRIES: 3,
    MINUTES_TIMEOUT: 5,
    MS_PER_SECOND: 1000,
    SECONDS_PER_MINUTE: 60
  };

  /**
   * Time units for the executer class.
   */
  IMPORT_TIMEOUT_MS =
    Executer.UNITS.MINUTES_TIMEOUT *
    Executer.UNITS.SECONDS_PER_MINUTE *
    Executer.UNITS.MS_PER_SECOND;

  /**
   * Create a new executer instance.
   * @param config - The pull configuration object
   */
  constructor(config: PullConfig) {
    this.config = config;
  }

  /**
   * Validate the dependencies required for the pull operation.
   */
  private validateDependencies() {
    const { authMethod } = this.config.remote;

    const requiredCommands = [
      ...(authMethod === 'password' ? ['sshpass'] : []),
      'ssh',
      'rsync',
      'mysqldump',
      'gzip',
      'gunzip'
    ];

    const missingCommands = requiredCommands.filter((cmd) => {
      try {
        execSync(`command -v ${cmd}`);
        return false;
      } catch {
        return true;
      }
    });

    if (missingCommands.length) {
      throw new Error(`Missing dependencies: ${missingCommands.join(', ')}`);
    }
  }

  /**
   * Execute a remote command.
   * @param command - The command to execute
   * @param errorMessage - The error message to display on failure
   * @returns A promise that resolves when the command completes successfully
   */
  private async executeRemoteCommand(
    command: string[],
    errorMessage: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(command[0], command.slice(1), { shell: false });
      const buffers = { stdout: '', stderr: '' };

      process.stdout.on('data', (data) => (buffers.stdout += data.toString()));
      process.stderr.on('data', (data) => (buffers.stderr += data.toString()));

      process.on('close', (code) => {
        const message = `${buffers.stdout}${buffers.stderr}`.trim();

        if (code === 0) {
          if (message) Printer.log(message.trim());
          resolve();
        } else {
          Printer.error(`Exit code: ${code}`);
          if (message) Printer.error(message.trim());
          reject(new Error(errorMessage));
        }
      });

      process.on('error', (error) => {
        Printer.error(error instanceof Error ? error.message : String(error));
        reject(error);
      });
    });
  }

  /**
   * Create a remote database backup.
   * @returns A promise that resolves with the path to the remote backup file
   */
  private async createRemoteDbBackup(): Promise<string> {
    const {
      host,
      user,
      port,
      authMethod,
      password,
      keyPath,
      dbName,
      dbUser,
      dbPassword,
      tempFolder
    } = this.config.remote;

    let backupCommand: string[] = [];
    const escapedDbPassword = dbPassword.replace(/[$`"\\]/g, '\\$&');
    const remoteTempFile = path.join(tempFolder, 'temp-db-backup.sql.gz');

    if (authMethod === 'key') {
      if (!keyPath || !fs.existsSync(keyPath)) {
        throw new Error(
          `SSH key ${!keyPath ? 'path required' : `file not found at ${keyPath}`}`
        );
      }
      backupCommand = [
        'ssh',
        '-o',
        'StrictHostKeyChecking=no',
        '-p',
        port.toString(),
        '-i',
        keyPath,
        `${user}@${host}`,
        `mysqldump --force --no-tablespaces --default-character-set=utf8mb3 -u${dbUser} -p${escapedDbPassword} ${dbName} | gzip > ${remoteTempFile}`
      ];
    }

    if (authMethod === 'password') {
      if (!password) {
        throw new Error('Password is required for password authentication');
      }
      backupCommand = [
        'sshpass',
        '-p',
        password,
        'ssh',
        '-o',
        'StrictHostKeyChecking=no',
        '-p',
        port.toString(),
        `${user}@${host}`,
        `mysqldump --force --no-tablespaces --default-character-set=utf8mb3 -u${dbUser} -p${escapedDbPassword} ${dbName} | gzip > ${remoteTempFile}`
      ];
    }

    try {
      await this.executeRemoteCommand(
        backupCommand,
        'Failed to create remote backup'
      );
      Printer.log('Remote database backup created successfully', 'success');
      return remoteTempFile;
    } catch (error) {
      Printer.error(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Copy the remote database backup locally.
   * @param remoteTempFile - The path to the remote backup file
   * @returns A promise that resolves with the path to the local backup file
   */
  private async copyRemoteBackup(remoteTempFile: string): Promise<string> {
    const { host, user, port, authMethod, password, keyPath } =
      this.config.remote;

    fs.ensureDirSync(this.config.local.tempFolder);
    const localTempFile = path.join(
      this.config.local.tempFolder,
      `db-backup-${Date.now()}.sql.gz`
    );

    let scpCommand: string[] = [];

    if (authMethod === 'key') {
      if (!keyPath || !fs.existsSync(keyPath)) {
        throw new Error(
          `SSH key ${!keyPath ? 'path required' : `file not found at ${keyPath}`}`
        );
      }
      scpCommand = [
        'scp',
        '-C',
        '-o',
        'StrictHostKeyChecking=no',
        '-P',
        port.toString(),
        '-i',
        keyPath,
        `${user}@${host}:${remoteTempFile}`,
        localTempFile
      ];
    }

    if (authMethod === 'password') {
      if (!password) {
        throw new Error('Password is required for password authentication');
      }
      scpCommand = [
        'sshpass',
        '-p',
        password,
        'scp',
        '-C',
        '-o',
        'StrictHostKeyChecking=no',
        '-P',
        port.toString(),
        `${user}@${host}:${remoteTempFile}`,
        localTempFile
      ];
    }
    try {
      await this.executeRemoteCommand(scpCommand, 'Failed to copy backup');
      Printer.log('Database backup copied successfully', 'success');
      return localTempFile;
    } catch (error) {
      Printer.error(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Import the database backup locally.
   * @param localTempFile - The path to the local backup file
   * @param retries - The number of retries to attempt
   */
  private async importDatabase(
    localTempFile: string,
    retries: number = Executer.UNITS.IMPORT_RETRIES
  ): Promise<void> {
    const { dbHost, dbName, dbUser, dbPort, dbPassword } = this.config.local;
    const escapedDbPassword = dbPassword.replace(/[$`"\\]/g, '\\$&');

    const importCommand = [
      'mysql',
      '-h',
      dbHost,
      '-P',
      dbPort.toString(),
      '-u',
      dbUser,
      `-p${escapedDbPassword}`,
      dbName
    ];

    const attemptImport = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const importProcess = spawn('mysql', importCommand.slice(1), {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        const buffers = { stdout: '', stderr: '' };

        const gunzipProcess = spawn('gunzip', ['-c', localTempFile], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        const gunzipBuffers = { stdout: '', stderr: '' };

        importProcess.stdout.on(
          'data',
          (data) => (buffers.stdout += data.toString())
        );
        importProcess.stderr.on(
          'data',
          (data) => (buffers.stderr += data.toString())
        );

        gunzipProcess.stderr.on(
          'data',
          (data) => (gunzipBuffers.stderr += data.toString())
        );

        // Pipe the decompressed SQL data into MySQL
        const fileStream = fs.createReadStream(localTempFile);
        fileStream.pipe(gunzipProcess.stdin);
        gunzipProcess.stdout.pipe(importProcess.stdin);

        const importTimeout = setTimeout(() => {
          Printer.error(
            'Database import timeout reached. Terminating processes...'
          );
          importProcess.kill('SIGKILL');
          gunzipProcess.kill('SIGKILL');
          fileStream.destroy();
          const message = `${buffers.stdout}${buffers.stderr}`.trim();
          if (message) Printer.error(message);
          reject(new Error('Database import timed out'));
        }, this.IMPORT_TIMEOUT_MS);

        importProcess.on('close', (code) => {
          clearTimeout(importTimeout);
          const message = `${buffers.stdout}${buffers.stderr}`.trim();

          if (code === 0) {
            Printer.log('Database imported successfully', 'success');
            Printer.log(message.trim());

            Printer.log('Database updates...', 'section');
            this.updateDatabaseValues()
              .then(() => resolve())
              .catch(reject);
          } else {
            Printer.error(`Exit code: ${code}`);
            Printer.error(message.trim());
            reject(new Error(`Database import failed with exit code ${code}`));
          }
        });

        importProcess.on('error', (error) => {
          clearTimeout(importTimeout);
          Printer.error(
            `Database import process error: ${error instanceof Error ? error.message : String(error)}`
          );
          reject(error);
        });

        gunzipProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Gunzip failed: ${gunzipBuffers.stderr.trim()}`));
          }
        });

        gunzipProcess.on('error', (error) => {
          Printer.error(
            `Gunzip process error: ${error instanceof Error ? error.message : String(error)}`
          );
          reject(error);
        });

        // Handle stream errors
        fileStream.on('error', (error) => {
          Printer.error(
            `File stream error: ${error instanceof Error ? error.message : String(error)}`
          );
          reject(error);
        });

        gunzipProcess.stdin.on('error', (error) => {
          Printer.error(
            `Gunzip stdin error: ${error instanceof Error ? error.message : String(error)}`
          );
          reject(error);
        });

        gunzipProcess.stdout.on('error', (error) => {
          Printer.error(
            `Gunzip stdout error: ${error instanceof Error ? error.message : String(error)}`
          );
          reject(error);
        });

        importProcess.stdin.on('error', (error) => {
          Printer.error(
            `MySQL stdin error: ${error instanceof Error ? error.message : String(error)}`
          );
          reject(error);
        });

        importProcess.stdout.on('error', (error) => {
          Printer.error(
            `MySQL stdout error: ${error instanceof Error ? error.message : String(error)}`
          );
          reject(error);
        });

        // Close stdin streams properly when file reading is done
        fileStream.on('end', () => {
          gunzipProcess.stdin.end();
        });

        gunzipProcess.stdout.on('end', () => {
          importProcess.stdin.end();
        });
      });
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await attemptImport();
        return; // If successful, exit the function
      } catch (error) {
        if (attempt < retries) {
          Printer.error(`Attempt ${attempt} failed. Retrying...`);
        } else {
          Printer.error(`All ${retries} attempts failed.`);
          throw error;
        }
      }
    }
  }

  /**
   * Update database values based on the configuration.
   */
  private async updateDatabaseValues(): Promise<void> {
    const { dbHost, dbName, dbUser, dbPort, dbPassword, databaseUpdates } =
      this.config.local;
    const escapedDbPassword = dbPassword.replace(/[$`"\\]/g, '\\$&');

    if (!databaseUpdates || databaseUpdates.length === 0) {
      Printer.log('No database updates configured, skipping', 'warning');
      return;
    }

    return new Promise((resolve, reject) => {
      const connection = mysql.createConnection({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: escapedDbPassword,
        database: dbName
      });

      // Perform updates sequentially
      const performUpdates = async () => {
        for (const update of databaseUpdates) {
          const { table, column, conditions = [], value } = update;

          // Construct the dynamic query
          let query = `UPDATE ${table} SET ${column} = ?`;
          const queryParams = [value];

          // Add WHERE conditions if provided
          if (conditions.length > 0) {
            const conditionClauses = conditions.map((cond: SqlCondition) => {
              // Handle IN clause differently
              if (cond.operator.toUpperCase() === 'IN') {
                // Ensure value is an array
                const inValues = Array.isArray(cond.value)
                  ? cond.value
                  : [cond.value];
                queryParams.push(...inValues);
                return `${cond.column} IN (${inValues.map(() => '?').join(',')})`;
              }
              // For other operators
              queryParams.push(
                Array.isArray(cond.value) ? cond.value.join(',') : cond.value
              );
              return `${cond.column} ${cond.operator} ?`;
            });

            query += ` WHERE ${conditionClauses.join(' AND ')}`;
          }

          try {
            Printer.log(`Executing query: ${query}`);
            Printer.log(`With params: ${JSON.stringify(queryParams)}`);

            const [result] = await connection
              .promise()
              .query(query, queryParams);
            const rowsAffected = (result as mysql.ResultSetHeader).affectedRows;
            Printer.log(`Updated ${rowsAffected} rows in ${table}`, 'success');
          } catch (error) {
            Printer.error(
              `Failed to update ${table}: ${error instanceof Error ? error.message : String(error)}`
            );
            continue;
          }
        }
      };

      performUpdates()
        .then(() => {
          connection.end();
          resolve();
        })
        .catch((error) => {
          connection.end();
          reject(error);
        });
    });
  }

  /**
   * Import files from the remote server.
   */
  private async importFiles(): Promise<void> {
    const { host, user, port, authMethod, password, keyPath, remoteFiles } =
      this.config.remote;
    const { localFiles } = this.config.local;

    let rsyncCommand: string[] = [];

    if (authMethod === 'key') {
      if (!keyPath || !fs.existsSync(keyPath)) {
        throw new Error(
          `SSH key ${!keyPath ? 'path required' : `file not found at ${keyPath}`}`
        );
      }
      rsyncCommand = [
        'rsync',
        '-avz',
        '-e',
        `ssh -o StrictHostKeyChecking=no -p ${port} -i ${keyPath}`,
        '--progress',
        '--delete',
        `${user}@${host}:${remoteFiles}`,
        localFiles
      ];
    }

    if (authMethod === 'password') {
      if (!password) {
        throw new Error('Password is required for password authentication');
      }
      rsyncCommand = [
        'sshpass',
        '-p',
        password,
        'rsync',
        '-avz',
        '-e',
        `ssh -o StrictHostKeyChecking=no -p ${port}`,
        '--progress',
        '--delete',
        `${user}@${host}:${remoteFiles}`,
        localFiles
      ];
    }

    try {
      await this.executeRemoteCommand(rsyncCommand, 'Rsync failed');
      Printer.log('Uploads synchronized successfully', 'success');
    } catch (error) {
      Printer.error(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Clean up temporary files and directories.
   * @param debug - Whether to keep the local backup in debug mode
   * @param localTempFile - The path to the local backup file
   * @param remoteTempFile - The path to the remote backup file
   */
  private async cleanup(
    debug: boolean,
    localTempFile?: string,
    remoteTempFile?: string
  ): Promise<void> {
    const cleanupTasks = [
      // Local backup cleanup (if not in debug mode)
      ...(debug
        ? []
        : [
            (async () => {
              try {
                if (localTempFile && (await fs.pathExists(localTempFile))) {
                  fs.unlink(localTempFile);
                }
              } catch (error) {
                Printer.error(`Failed to remove local backup: ${error}`);
              }
            })()
          ]),

      // Remote backup cleanup
      (async () => {
        const { host, user, port, authMethod, password, keyPath } =
          this.config.remote;

        let deleteRemoteBackupCommand: string[] = [];

        if (authMethod === 'key') {
          if (!keyPath || !fs.existsSync(keyPath)) {
            throw new Error(
              `SSH key ${!keyPath ? 'path required' : `file not found at ${keyPath}`}`
            );
          }
          deleteRemoteBackupCommand = [
            'ssh',
            '-o',
            'StrictHostKeyChecking=no',
            '-p',
            port.toString(),
            '-i',
            keyPath,
            `${user}@${host}`,
            `rm -f ${remoteTempFile}`
          ];
        }

        if (authMethod === 'password') {
          if (!password) {
            throw new Error('Password is required for password authentication');
          }
          deleteRemoteBackupCommand = [
            'sshpass',
            '-p',
            password,
            'ssh',
            '-o',
            'StrictHostKeyChecking=no',
            '-p',
            port.toString(),
            `${user}@${host}`,
            `rm -f ${remoteTempFile}`
          ];
        }

        try {
          await this.executeRemoteCommand(
            deleteRemoteBackupCommand,
            'Failed to delete remote backup'
          );
        } catch (error) {
          Printer.error(`Failed to remove remote backup: ${error}`);
        }
      })()
    ];

    if (debug) {
      Printer.log(
        `Debug mode: Keeping local backup at ${localTempFile}`,
        'warning'
      );
    }

    await Promise.all(cleanupTasks);
  }

  /**
   * Pull the database and files from the remote server.
   * @param options - The pull options
   * @param spinner - The spinner instance for logging progress
   * @returns A promise that resolves when the pull operation completes
   */
  async pull(options: PullOptions = {}, spinner: Ora) {
    const startTime = Date.now();
    const { skipDb = false, skipFiles = false, debug = false } = options;
    let localTempFile, remoteTempFile;
    try {
      // Validate dependencies
      this.validateDependencies();

      if (!skipDb) {
        Printer.log('Pulling database...', 'subheader');
        spinner.text = 'Pulling database...';

        // Create remote backup
        Printer.log('Creating remote database backup...', 'section');
        spinner.text = 'Creating remote database backup...';
        remoteTempFile = await this.createRemoteDbBackup();

        // Copy backup locally
        Printer.log('Copying remote database backup...', 'section');
        spinner.text = 'Copying remote database backup...';
        localTempFile = await this.copyRemoteBackup(remoteTempFile);

        // Import database
        Printer.log('Importing database...', 'section');
        spinner.text = 'Importing database...';
        await this.importDatabase(localTempFile);
      }

      if (!skipFiles) {
        // Import Files
        Printer.log('Pulling files...', 'subheader');
        spinner.text = 'Pulling files...';
        await this.importFiles();
      }

      const duration = (Date.now() - startTime) / Executer.UNITS.MS_PER_SECOND;

      return {
        success: true,
        duration
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail('Pull failed');
      Printer.log(`Pull failed: ${message}`, 'error');
      throw error;
    } finally {
      Printer.log('Cleaning up...', 'subheader');
      spinner.text = 'Cleaning up...';
      await this.cleanup(debug, localTempFile, remoteTempFile)
        .then(() => !debug && Printer.log('Cleanup complete', 'success'))
        .catch((err) => Printer.error(`Cleanup failed: ${err}`));
    }
  }

  // Static utility method for quick usage
  static async quickPull(
    config: PullConfig,
    spinner: Ora,
    options?: PullOptions
  ) {
    const puller = new Executer(config);
    return puller.pull(options, spinner);
  }
}
