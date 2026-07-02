import { defineConfig } from "oxlint";

export default defineConfig({
  options: {
    typeAware: true,
  },
  jsPlugins: ["@e18e/eslint-plugin"],
  rules: {
    "oxc/no-barrel-file": "error",
    "e18e/prefer-static-regex": "error",
    "e18e/prefer-regex-test": "error",
  },
});
