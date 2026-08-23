import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * Las tres reglas de `no-restricted-syntax` vienen literalmente del
 * `_adherence.oxlintrc.json` que publica el design system Nocturne en Claude
 * Design. Son la forma automatizable de la disciplina de la decisión D6:
 * ningún color, distancia ni fuente a pelo — todo sale de var(--…).
 */
const adherenciaNocturne = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
      message:
        "Color en hexadecimal a pelo — usa un token del design system con var(--color-*).",
    },
    {
      selector: "Literal[value=/\\b\\d+px\\b/]",
      message:
        "Valor en px a pelo — usa un token del design system con var(--space-*) o var(--radius-*).",
    },
    {
      selector: "Literal[value=/font-family\\s*:\\s*(?!['\"]?(?:Inter))/i]",
      message:
        "Fuente fuera del design system. La única disponible es Inter, vía var(--font-heading) o var(--font-body).",
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "build/**",
      ".react-router/**",
      "node_modules/**",
      "worker-configuration.d.ts",
      // Ficheros que escribe la CLI de Supabase al arrancar los contenedores.
      "supabase/.temp/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...adherenciaNocturne,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
