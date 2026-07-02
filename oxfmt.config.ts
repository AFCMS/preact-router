import { defineConfig } from "oxfmt";

export default defineConfig({
  sortImports: true,
  sortPackageJson: true,
  overrides: [
    {
      files: ["*.json"],
      options: {
        tabWidth: 4,
      },
    },
  ],
});
