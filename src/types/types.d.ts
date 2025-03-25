export interface SqlCondition {
  column: string;
  operator: string;
  value: string | string[];
}
export interface DatabaseUpdate {
  table: string;
  column: string;
  conditions: SqlCondition[];
  value: string;
}
export interface RemoteConfig {
  host: string;
  user: string;
  port: number;
  authMethod: "password" | "key";
  password?: string;
  keyPath?: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  remoteFiles: string;
}

export interface LocalConfig {
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbPort: number;
  localFiles: string;
  databaseUpdates?: DatabaseUpdate[];
}

export interface PullConfig {
  remote: RemoteConfig;
  local: LocalConfig;
}

export interface PullOptions {
  skipDb?: boolean;
  skipFiles?: boolean;
}
