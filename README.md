# **Lando Pull**

<p align="center"><i>A CLI tool for syncing remote databases and files to your local Lando environment.</i></p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@sp-packages/lando-pull" alt="npm version">
  <a href="https://packagephobia.com/result?p=@sp-packages/lando-pull"><img src="https://packagephobia.com/badge?p=@sp-packages/lando-pull" alt="install size"></a>
  <img src="https://img.shields.io/npm/dw/@sp-packages/lando-pull" alt="npm downloads">
  <img src="https://img.shields.io/npm/l/@sp-packages/lando-pull" alt="license">
  <img src="https://github.com/SP-Packages/lando-pull/actions/workflows/release.yml/badge.svg" alt="build status">
  <a href="https://github.com/semantic-release/semantic-release"><img src="https://img.shields.io/badge/semantic--release-conventionalcommits-e10079?logo=semantic-release" alt="semantic-release"></a>
  <img src="https://img.shields.io/badge/Made%20with-TypeScript-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg" alt="Prettier">
  <a href="https://codecov.io/gh/SP-Packages/lando-pull"><img src="https://codecov.io/gh/SP-Packages/lando-pull/graph/badge.svg?token=60X95UNTQL" alt="codecov"></a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome">
  <a href="https://github.com/sponsors/iamsenthilprabu"><img src="https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?logo=github" alt="Sponsor"></a>
</p>

## **✨ Features**

- 🔄 **Sync remote databases** to your local Lando environment.
- 📂 **Sync remote files** with `rsync`.
- 🔑 **Supports password & SSH key authentication**.
- ⚙ **Customizable configuration** via `.landorc`.
- 🚀 **Fast execution with minimal setup**.
- 🏗 **Ideal for development workflows** with WordPress & Lando.

---

## **📦 Installation**

### **Global Installation**

```sh
npm install -g lando-pull
```

This allows you to use `lando-pull` globally in your terminal.

### **Local Installation**

```sh
npm install lando-pull --save-dev
```

Then, run it via:

```sh
npx lando-pull
```

---

## **🚀 CLI Usage**

### **Basic Usage**

```sh
lando-pull [options]
```

#### **Options:**

```sh
Usage: Lando Pull [options]

A CLI tool for syncing remote databases and files to your local Lando environment.

Options:
  -V, --version           output the version number
  -c, --config <config>   Path to the configuration file (default: .landorc)
  -d, --debug             Debug mode
  -q, --quiet             Disable output
  -v, --verbose           Enable verbose logging
  --skip-db               Skip database
  --skip-files            Skip files
  --auth-method <method>  Authentication method: 'password' or 'key'
  --key-path <keyPath>    Path to SSH private key (for key-based auth)
  --password [password]   Remote server password (for password auth, recommended via ENV)
  -h, --help              display help for command
```

#### **Examples:**

```sh
lando-pull --auth-method key --key-path ~/.ssh/id_rsa
lando-pull --config custom-landorc.json --verbose
lando-pull --skip-files
lando-pull --auth-method password --password my_secure_password
```

---

## **⚙️ Configuration (`.landorc`)**

Lando Pull uses a configuration file (`.landorc`) to define remote connection details.

### **Example Configuration:**

```json
{
  "remote": {
    "host": "example.com",
    "user": "ssh_user",
    "port": 22,
    "authMethod": "key",
    "keyPath": "/path/to/private/key",
    "dbName": "database_name",
    "dbUser": "database_user",
    "dbPassword": "database_password",
    "tempFolder": "/tmp",
    "remoteFiles": "website/root/path/uploads"
  },
  "local": {
    "dbHost": "127.0.0.1",
    "dbName": "wordpress",
    "dbUser": "wordpress",
    "dbPassword": "wordpress",
    "dbPort": 3306,
    "tempFolder": "/tmp",
    "localFiles": "website/root/path/uploads",
    "databaseUpdates": [
      {
        "table": "wp_users",
        "column": "user_email",
        "conditions": [
          {
            "column": "user_login",
            "operator": "=",
            "value": "admin"
          }
        ],
        "value": "local-admin@example.com"
      }
    ]
  }
}
```

### **Configurable Options**

| Key                 | Description                                         |
| ------------------- | --------------------------------------------------- |
| `remote.host`       | Remote server hostname                              |
| `remote.user`       | SSH username                                        |
| `remote.port`       | SSH port (default: `22`)                            |
| `remote.path`       | Remote folder to sync (e.g., `/wp-content/uploads`) |
| `remote.dbName`     | Remote database name                                |
| `remote.dbUser`     | Remote database username                            |
| `remote.dbPassword` | Remote database password                            |
| `remote.dbHost`     | Remote database host (e.g., `127.0.0.1`)            |
| `remote.authMethod` | Authentication method (`password` or `key`)         |
| `remote.keyPath`    | SSH key file path (if using key authentication)     |
| `local.dbName`      | Local database name                                 |
| `local.filesPath`   | Local folder to sync (e.g., `/wp-content/uploads`)  |

---

## **📜 Example Outputs**

```sh
############################################################
 Running Lando Pull
############################################################
**************************************************
 Pulling database
**************************************************
✔ [SUCCESS] Database imported successfully.
**************************************************
 Syncing files
**************************************************
✔ [SUCCESS] Files synchronized via rsync.
**************************************************
 Lando Pull Completed
**************************************************
🎉 All tasks completed successfully!
```

---

## **💡 Use Cases**

- **WordPress Development** – Easily pull live database & uploads to your local Lando site.
- **Backup & Restore** – Quickly sync remote backups for local testing.
- **CI/CD Integration** – Automate database and file sync in deployment workflows.

---

## **🤝 Contributing**

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

---

## **📜 License**

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
