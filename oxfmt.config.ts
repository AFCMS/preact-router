import { defineConfig } from "oxfmt";

export default defineConfig({
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
