import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  sourcemap: true,
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
