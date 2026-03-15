import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    {
        files: ["src/**/*.{js,mjs,cjs,ts,mts,cts,vue}"],
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: { globals: globals.browser },
    },
    tseslint.configs.recommended,
    pluginVue.configs["flat/essential"],
    {
        files: ["src/**/*.vue"],
        languageOptions: { parserOptions: { parser: tseslint.parser } },
        rules: {
            "vue/multi-word-component-names": "off",
        },
    },
]);
