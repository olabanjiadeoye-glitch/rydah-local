import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Rydah intentionally hydrates browser-only auth/location state after mount.
      // These React Compiler optimization rules are not correctness failures for this pattern.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",

      // Auth changes and third-party payment/verification returns intentionally use
      // full-document navigation so browser session state is re-read from a clean boundary.
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
