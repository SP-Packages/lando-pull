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
  -c, --config <config>  Path to the configuration file (default: .landorc)
  --skip-db              Skip database sync
  --skip-files           Skip file sync
  --auth-method <method> Authentication method: 'password' or 'key'
  --password <password>  Remote server password (recommended via ENV)
  --key-path <keyPath>   Path to SSH private key (for key-based authentication)
  -q, --quiet            Disable output
  -v, --verbose          Enable verbose logging
  -h, --help             Display help for command
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
    "user": "ssh_user_name",
    "port": 22,
    "path": "/var/www/html",
    "db": {
      "name": "remote_db",
      "user": "db_user",
      "password": "db_pass",
      "host": "127.0.0.1"
    },
    "authMethod": "key",
    "keyPath": "~/.ssh/id_rsa"
  },
  "local": {
    "dbName": "local_db",
    "filesPath": "wp-content/uploads"
  }
}
```

### **Configurable Options**

| Key                  | Description                                         |
| -------------------- | --------------------------------------------------- |
| `remote.host`        | Remote server hostname                              |
| `remote.user`        | SSH username                                        |
| `remote.port`        | SSH port (default: `22`)                            |
| `remote.path`        | Remote folder to sync (e.g., `/wp-content/uploads`) |
| `remote.db.name`     | Remote database name                                |
| `remote.db.user`     | Remote database username                            |
| `remote.db.password` | Remote database password                            |
| `remote.db.host`     | Remote database host (e.g., `127.0.0.1`)            |
| `remote.authMethod`  | Authentication method (`password` or `key`)         |
| `remote.keyPath`     | SSH key file path (if using key authentication)     |
| `local.dbName`       | Local database name                                 |
| `local.filesPath`    | Local folder to sync (e.g., `/wp-content/uploads`)  |

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
