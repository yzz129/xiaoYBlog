module.exports = {
    root: true,
    env: {
        node: true,
    },
    parser: "vue-eslint-parser",
    parserOptions: {
        // for script
        parser: "@typescript-eslint/parser",
        ecmaVersion: 2020,
    },
    extends: [
        "eslint:recommended",
        "plugin:import/recommended",
        "plugin:import/typescript", // this line does the trick
        "plugin:vue/vue3-strongly-recommended",
        "@vue/typescript/recommended",
        "@vue/prettier",
    ],
    plugins: ["import"],
    settings: {
        "import/parsers": {
            "@typescript-eslint/parser": [".ts", ".tsx"],
        },
        "import/resolver": {
            typescript: {
                project: "./tsconfig.json",
            },
        },
    },
    rules: {
        "no-console": [1, { allow: ["warn", "error"] }],
        "no-debugger": 2,
        "no-case-declarations": 0,
        "import/order": 1,
        // https://eslint.vuejs.org/rules/
        "vue/require-default-prop": 0,
        "vue/multi-word-component-names": 0,
    },
    overrides: [
        {
            files: ["**/__tests__/*.{j,t}s?(x)", "**/tests/unit/**/*.spec.{j,t}s?(x)"],
            env: {
                jest: true,
            },
        },
        {
            files: ["*.ts", "*.tsx", "*.vue"],
            plugins: ["@typescript-eslint"],
            rules: {
                "@typescript-eslint/no-explicit-any": [2, { ignoreRestArgs: true }],
            },
        },
    ],
};
