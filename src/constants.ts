import { PullConfig } from './types/types.js';
/**
 * Default configuration for the Lando Pull.
 */
export const DEFAULT_CONFIG: PullConfig = {
  remote: {
    host: 'example.com',
    user: 'ssh_user',
    port: 22,
    authMethod: 'key',
    keyPath: '/path/to/private/key', // CHANGE THIS
    dbName: 'database_name', // CHANGE THIS
    dbUser: 'database_user', // CHANGE THIS
    dbPassword: 'database_password', // CHANGE THIS
    tempFolder: '/tmp',
    remoteFiles: 'website/root/path'
  },
  local: {
    dbHost: '127.0.0.1',
    dbName: 'wordpress', // CHANGE THIS
    dbUser: 'wordpress', // CHANGE THIS
    dbPassword: 'wordpress', // CHANGE THIS
    dbPort: 3306,
    tempFolder: '/tmp',
    localFiles: 'website/root/path',
    databaseUpdates: [
      {
        table: 'wp_options',
        column: 'option_value',
        conditions: [
          {
            column: 'option_name',
            operator: 'IN',
            value: ['siteurl', 'home']
          }
        ],
        value: 'http://site.lndo.site'
      },
      {
        table: 'wp_users',
        column: 'user_email',
        conditions: [
          {
            column: 'user_login',
            operator: '=',
            value: 'admin'
          }
        ],
        value: 'local-admin@example.com'
      }
    ]
  }
};
