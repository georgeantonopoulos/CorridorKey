import { builtinModules } from "node:module";
import { defineConfig } from "vite";

export const external = [
  "electron",
  ...builtinModules,
  ...builtinModules.map((module) => `node:${module}`)
];

export default defineConfig({
  build: {
    sourcemap: true
  }
});
