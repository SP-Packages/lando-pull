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
   *
   * @returns A promise that resolves when the import is complete
   */
  private async importDatabase(
    localTempFile: string,
    retries: number = Executer.UNITS.IMPORT_RETRIES
  ): Promise<string> {
    // Try direct import first (decompress then import)
    try {
      Printer.log('Starting database import using direct method...');
      const tempUncompressedFile = await this.directImport(localTempFile);
      return tempUncompressedFile;
    } catch (directError) {
      const directErrorMsg =
        directError instanceof Error
          ? directError.message
          : String(directError);
      Printer.error(`Direct import failed: ${directErrorMsg}`);
      Printer.log('Falling back to pipe method...', 'warning');
    }

    // Fall back to gunzip pipe method if direct import fails
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        Printer.log(`Pipe method attempt ${attempt}/${retries}...`);
        await this.pipeImport(localTempFile);
        Printer.log(
          'Database import completed successfully with pipe method',
          'success'
        );
        return localTempFile;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        Printer.error(`Pipe import attempt ${attempt} failed: ${errorMessage}`);

        if (attempt < retries) {
          Printer.log(`Retrying...`, 'warning');
        } else {
          Printer.error(`All ${retries} attempts failed.`);
          throw new Error(
            `Database import failed after all attempts: ${errorMessage}`
          );
        }
      }
    }
    return localTempFile; // Add default return
  }

  /**
   * Import database using the direct method (decompress first, then import).
   * @param localTempFile - The path to the compressed backup file
   *
   * @returns A promise that resolves with the path to the uncompressed SQL file
   */
  private async directImport(localTempFile: string): Promise<string> {
    const { dbHost, dbName, dbUser, dbPort, dbPassword } = this.config.local;

    // Create a temporary uncompressed file with unique name
    const tempUncompressedFile = `${localTempFile.replace('.gz', '')}.${Date.now()}.sql`;

    Printer.log(`Direct Import`, 'section');
    // eslint-disable-next-line no-useless-catch
    try {
      // Step 1: Decompress the file
      await this.decompressFile(localTempFile, tempUncompressedFile);

      // Step 2: Import the uncompressed file
      await this.importSqlFile(
        tempUncompressedFile,
        dbHost,
        dbPort,
        dbUser,
        dbPassword,
        dbName
      );

      // Step 3: Update database values
      await this.updateDatabaseValues();

      Printer.log('Database Pull Summary', 'section');
      return tempUncompressedFile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Decompress a gzipped file to a destination path.
   * @param sourceFile - The source gzipped file
   * @param destFile - The destination uncompressed file
   */
  private async decompressFile(
    sourceFile: string,
    destFile: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const gunzip = spawn('gunzip', ['-c', sourceFile]);
      const writeStream = fs.createWriteStream(destFile);

      let gunzipError: Error | null = null;

      gunzip.stdout.pipe(writeStream);

      gunzip.stderr.on('data', (data) => {
        Printer.error(`Gunzip stderr: ${data.toString()}`);
      });

      gunzip.on('error', (error) => {
        gunzipError = error;
        Printer.error(`Gunzip process error: ${error.message}`);
        reject(error);
      });

      writeStream.on('error', (error) => {
        Printer.error(`Write stream error: ${error.message}`);
        reject(error);
      });

      writeStream.on('finish', () => {
        if (!gunzipError) {
          Printer.log('File decompressed successfully', 'success');
          resolve();
        }
      });

      gunzip.on('close', (code) => {
        if (code !== 0 && !gunzipError) {
          const error = new Error(`Gunzip process exited with code ${code}`);
          Printer.error(error.message);
          reject(error);
        }
      });
    });
  }

  /**
   * Import an SQL file into the database.
   * @param sqlFile - The SQL file to import
   * @param host - The database host
   * @param port - The database port
   * @param user - The database user
   * @param password - The database password
   * @param database - The database name
   */
  private async importSqlFile(
    sqlFile: string,
    host: string,
    port: number,
    user: string,
    password: string,
    database: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const escapedPassword = password.replace(/[$`"\\]/g, '\\$&');

      const mysqlProcess = spawn('mysql', [
        '-h',
        host,
        '-P',
        port.toString(),
        '-u',
        user,
        `-p${escapedPassword}`,
        database
      ]);

      const fileStream = fs.createReadStream(sqlFile);
      const buffers = { stdout: '', stderr: '' };

      mysqlProcess.stdout.on('data', (data) => {
        buffers.stdout += data.toString();
      });

      mysqlProcess.stderr.on('data', (data) => {
        buffers.stderr += data.toString();
      });

      fileStream.pipe(mysqlProcess.stdin);

      const importTimeout = setTimeout(() => {
        Printer.error('Database import timed out');
        mysqlProcess.kill('SIGKILL');
        fileStream.destroy();
        reject(new Error('Database import timed out'));
      }, this.IMPORT_TIMEOUT_MS);

      mysqlProcess.on('close', (code) => {
        clearTimeout(importTimeout);
        const message = `${buffers.stdout}${buffers.stderr}`.trim();

        if (code === 0) {
          if (message) Printer.log(message.trim());
          Printer.log('Database imported successfully', 'success'); // Added success message
          resolve();
        } else {
          Printer.error(`MySQL exited with code ${code}`);
          if (message) Printer.error(message.trim());
          reject(new Error(`MySQL import failed with exit code ${code}`));
        }
      });

      mysqlProcess.on('error', (error) => {
        clearTimeout(importTimeout);
        Printer.error(`MySQL process error: ${error.message}`);
        reject(error);
      });

      fileStream.on('error', (error) => {
        clearTimeout(importTimeout);
        Printer.error(`File read error: ${error.message}`);
        reject(error);
      });

      mysqlProcess.stdin.on('error', (error) => {
        clearTimeout(importTimeout);
        Printer.error(`MySQL stdin error: ${error.message}`);
        reject(error);
      });

      fileStream.on('end', () => {
        mysqlProcess.stdin.end();
      });
    });
  }

  /**
   * Import database using the pipe method (gunzip piped directly to mysql).
   * @param localTempFile - The path to the compressed backup file
   */
  private async pipeImport(localTempFile: string): Promise<void> {
    const { dbHost, dbName, dbUser, dbPort, dbPassword } = this.config.local;
    const escapedDbPassword = dbPassword.replace(/[$`"\\]/g, '\\$&');

    return new Promise((resolve, reject) => {
      let importSucceeded = false;

      // MySQL import process
      const mysqlProcess = spawn('mysql', [
        '-h',
        dbHost,
        '-P',
        dbPort.toString(),
        '-u',
        dbUser,
        `-p${escapedDbPassword}`,
        dbName
      ]);

      // Gunzip process
      const gunzip = spawn('gunzip', ['-c', localTempFile]);

      const buffers = {
        mysqlStdout: '',
        mysqlStderr: '',
        gunzipStderr: ''
      };

      // Collect output
      mysqlProcess.stdout.on('data', (data) => {
        buffers.mysqlStdout += data.toString();
      });

      mysqlProcess.stderr.on('data', (data) => {
        buffers.mysqlStderr += data.toString();
      });

      gunzip.stderr.on('data', (data) => {
        buffers.gunzipStderr += data.toString();
      });

      // Pipe gunzip output to mysql input
      gunzip.stdout.pipe(mysqlProcess.stdin);

      // Set timeout
      const importTimeout = setTimeout(() => {
        Printer.error('Database import timed out');
        mysqlProcess.kill('SIGKILL');
        gunzip.kill('SIGKILL');
        reject(new Error('Database import timed out'));
      }, this.IMPORT_TIMEOUT_MS);

      // Handle MySQL process completion
      mysqlProcess.on('close', (code) => {
        clearTimeout(importTimeout);
        const message = `${buffers.mysqlStdout}${buffers.mysqlStderr}`.trim();

        if (code === 0) {
          if (message) Printer.log(message.trim());
          importSucceeded = true;

          // Close gunzip process if still running
          try {
            gunzip.kill();
          } catch {
            // Ignore errors when killing process
          }

          // Update database values after successful import
          this.updateDatabaseValues()
            .then(() => resolve())
            .catch((updateError) => {
              Printer.error(`Database update failed: ${updateError.message}`);
              resolve(); // Continue even if update fails
            });
        } else {
          Printer.error(`MySQL exited with code ${code}`);
          if (message) Printer.error(message.trim());
          reject(new Error(`MySQL import failed with exit code ${code}`));
        }
      });

      // Handle gunzip process completion
      gunzip.on('close', (code) => {
        if (importSucceeded) {
          // If MySQL already succeeded, we can ignore gunzip exit code
          return;
        }

        if (code !== 0) {
          Printer.error(`Gunzip exited with code ${code}`);
          const message = buffers.gunzipStderr.trim();
          if (message) Printer.error(message);
          reject(new Error(`Gunzip failed with exit code ${code}`));
        }
      });

      // Error handlers
      mysqlProcess.on('error', (error) => {
        clearTimeout(importTimeout);
        Printer.error(`MySQL process error: ${error.message}`);
        reject(error);
      });

      gunzip.on('error', (error) => {
        // If MySQL already succeeded, gunzip errors don't matter
        if (importSucceeded) return;

        Printer.error(`Gunzip process error: ${error.message}`);
        reject(error);
      });

      // Handle stream errors with special EPIPE handling
      gunzip.stdout.on('error', (error) => {
        if (importSucceeded) {
          Printer.log(
            'Ignoring gunzip stdout error after successful import',
            'warning'
          );
          return;
        }
        Printer.error(`Gunzip stdout error: ${error.message}`);
        reject(error);
      });

      mysqlProcess.stdin.on('error', (error) => {
        if (importSucceeded && error.message.includes('EPIPE')) {
          Printer.log(
            'Ignoring EPIPE error after successful import',
            'warning'
          );
          return;
        }
        Printer.error(`MySQL stdin error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Update database values based on the configuration.
   */
  private async updateDatabaseValues(): Promise<void> {
    const { dbHost, dbName, dbUser, dbPort, dbPassword, databaseUpdates } =
      this.config.local;
    const escapedDbPassword = dbPassword.replace(/[$`"\\]/g, '\\$&');

    Printer.log('Database updates', 'section');

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
   * @param tempUncompressedFile - The path to the temporary uncompressed file
   * @param remoteTempFile - The path to the remote backup file
   */
  private async cleanup(
    debug: boolean,
    localTempFile?: string,
    tempUncompressedFile?: string,
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
                  Printer.log('Local backup cleaned up', 'success');
                }
              } catch (error) {
                Printer.error(`Failed to remove local backup: ${error}`);
              }
            })()
          ]),

      // Temp UncompressedFile cleanup (if not in debug mode)
      ...(debug
        ? []
        : [
            (async () => {
              try {
                if (
                  tempUncompressedFile &&
                  (await fs.pathExists(tempUncompressedFile))
                ) {
                  fs.unlink(tempUncompressedFile);
                  Printer.log(
                    'Temporary uncompressed file cleaned up',
                    'success'
                  );
                }
              } catch (error) {
                Printer.error(
                  `Failed to remove Temporary Uncompressed File: ${error}`
                );
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
    let localTempFile, tempUncompressedFile, remoteTempFile;
    let dbSuccess = true;
    let filesSuccess = true;

    try {
      // Validate dependencies
      this.validateDependencies();

      if (!skipDb) {
        try {
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
          tempUncompressedFile = await this.importDatabase(localTempFile);

          Printer.log('Database pull completed successfully', 'success');
        } catch (dbError) {
          dbSuccess = false;
          const message =
            dbError instanceof Error ? dbError.message : String(dbError);
          Printer.log(`Database pull failed: ${message}`, 'error');
        }
      }

      if (!skipFiles) {
        try {
          // Import Files
          Printer.log('Pulling files...', 'subheader');
          spinner.text = 'Pulling files...';
          await this.importFiles();

          Printer.log('Files pull completed successfully', 'success');
        } catch (filesError) {
          filesSuccess = false;
          const message =
            filesError instanceof Error
              ? filesError.message
              : String(filesError);
          Printer.log(`Files pull failed: ${message}`, 'error');
        }
      }

      const duration = (Date.now() - startTime) / Executer.UNITS.MS_PER_SECOND;

      return {
        success: dbSuccess && filesSuccess,
        partialSuccess: dbSuccess || filesSuccess,
        dbSuccess,
        filesSuccess,
        duration
      };
    } catch (error) {
      // This should only trigger for dependency validation errors
      const message = error instanceof Error ? error.message : String(error);
      spinner.fail('Pull failed');
      Printer.log(`Pull failed: ${message}`, 'error');
      throw error;
    } finally {
      Printer.log('Cleaning up...', 'subheader');
      spinner.text = 'Cleaning up...';
      await this.cleanup(
        debug,
        localTempFile,
        tempUncompressedFile,
        remoteTempFile
      )
        .then(() => !debug && Printer.log('Cleanup complete', 'success'))
        .catch((err) => Printer.error(`Cleanup failed: ${err}`));
      spinner.stop();
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
