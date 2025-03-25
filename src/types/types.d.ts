/**
 * Represents a SQL condition for database queries
 * @param column - The database column name to apply the condition on
 * @param operator - The SQL operator to use (e.g., '=', '\>', '\<', 'IN', etc.)
 * @param value - The value(s) to compare against. Can be a single string or array of strings
 */
export interface SqlCondition {
  column: string;
  operator: string;
  value: string | string[];
}

/**
 * Defines a database update operation
 * @param table - The name of the table to update
 * @param column - The column to be updated
 * @param conditions - Array of conditions to determine which rows to update
 * @param value - The new value to set in the column
 */
export interface DatabaseUpdate {
  table: string;
  column: string;
  conditions: SqlCondition[];
  value: string;
}

/**
 *
 * Configuration for remote server settings
 *
 * @param host - Remote server hostname or IP address
 * @param user - SSH username for remote server access
 * @param port - SSH port number for remote server
 * @param authMethod - SSH authentication method: 'key' or 'password'
 * @param password - Remote server password (for password auth)
 * @param keyPath - Path to SSH private key (for key-based auth)
 * @param dbName - Remote database name
 * @param dbUser - Remote database username
 * @param dbPassword - Remote database password
 * @param remoteFiles - Path to files directory on remote server
 */
export interface RemoteConfig {
  host: string;
  user: string;
  port: number;
  authMethod: 'key' | 'password';
  password?: string;
  keyPath?: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  remoteFiles: string;
}

/**
 * Configuration for local environment settings
 * @param dbHost - Local database host address
 * @param dbName - Local database name
 * @param dbUser - Local database username
 * @param dbPassword - Local database password
 * @param dbPort - Local database port number
 * @param localFiles - Path to local files directory
 * @param databaseUpdates - Optional array of database updates to perform after pull
 */
export interface LocalConfig {
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbPort: number;
  localFiles: string;
  databaseUpdates?: DatabaseUpdate[];
}

/**
 * Complete configuration for pull operations
 * @param RemoteConfig - Remote server configuration
 * @param LocalConfig - Local environment configuration
 */
export interface PullConfig {
  remote: RemoteConfig;
  local: LocalConfig;
}

/**
 * Optional settings for pull operations
 * @param skipDb - Skip database pull when true
 * @param skipFiles - Skip files pull when true
 * @param authMethod - Optional SSH authentication method override
 * @param password - Optional SSH password override
 * @param keyPath - Optional SSH key path override
 * @param verbose - Enable verbose logging when true
 * @param quiet - Suppress all non-error output when true
 */
export interface PullOptions {
  skipDb?: boolean;
  skipFiles?: boolean;
  authMethod?: string;
  password?: string;
  keyPath?: string;
  verbose?: boolean;
  quiet?: boolean;
}
