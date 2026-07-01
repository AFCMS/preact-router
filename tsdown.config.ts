import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm", "cjs"],
  dts: {
    tsgo: true,
  },
  platform: "browser",
  exports: true,
  publint: {
    level: "error",
  },
  attw: true,
});
