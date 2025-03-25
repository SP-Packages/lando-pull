const rules = {
  off: 0,
  warn: 1,
  error: 2,
};

const length = {
  header: 72,
  body: 100,
};

const commitTypes = [
  "build",
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "test",
  "chore",
  "ci",
  "perf",
  "revert",
];

export default {
  extends: ["@commitlint/config-conventional"],
  ignores: [(commit) => commit.includes("[skip ci]")],
  rules: {
    "type-enum": [rules.error, "always", commitTypes],
    "subject-case": [rules.warn, "always", ["lower-case"]],
    "header-max-length": [rules.error, "always", length.header],
    "body-max-line-length": [rules.error, "always", length.body],
    "footer-leading-blank": [rules.warn, "always"],
    "subject-full-stop": [rules.error, "never", "."],
    "type-case": [rules.error, "always", "lower-case"],
  },
};
