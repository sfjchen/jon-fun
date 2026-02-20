import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import nextPlugin from "@next/eslint-plugin-next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".vercel/**",
      "out/**",
      "build/**",
      "public/**",
      "next-env.d.ts",
      "next.config.*",
      "postcss.config.*",
      "tailwind.config.*",
      "Smart OverlayEye/**",
      "TMR_audio/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "error",
      "no-var": "error",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/triple-slash-reference": "warn",
    },
  },
];

export default eslintConfig;
