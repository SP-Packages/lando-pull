import { PullConfig } from "./types/types.js";
/**
 * Default configuration for the Lando Pull.
 */
export const DEFAULT_CONFIG: PullConfig = {
  remote: {
    host: "example.com",
    user: "ssh_user",
    port: 22,
    authMethod: "key",
    keyPath: "/path/to/private/key",
    dbName: "database_name",
    dbUser: "database_user",
    dbPassword: "database_password",
    remoteFiles: "website/root/path",
  },
  local: {
    dbHost: "127.0.0.1",
    dbName: "wordpress",
    dbUser: "wordpress",
    dbPassword: "wordpress",
    dbPort: 3306,
    localFiles: "website/root/path",
    databaseUpdates: [
      {
        table: "wp_options",
        column: "option_value",
        conditions: [
          {
            column: "option_name",
            operator: "IN",
            value: ["siteurl", "home"],
          },
        ],
        value: "http://site.lndo.site",
      },
      {
        table: "wp_users",
        column: "user_email",
        conditions: [
          {
            column: "user_login",
            operator: "=",
            value: "admin",
          },
        ],
        value: "local-admin@example.com",
      },
    ],
  },
};
