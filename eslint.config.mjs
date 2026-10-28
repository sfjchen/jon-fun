import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
      "playwright-report/**",
      "test-results/**",
      "Veridian/**",
    ],
  },
  ...nextVitals,
  ...nextTs,
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
