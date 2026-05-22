import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild'

export default [{
    input: "./src/index.ts",
    output: [
        {
            file: "dist/cjs/index.cjs",
            format: "cjs",
            sourcemap: true,
            exports: "auto",
        },
        {
            file: "dist/esm/index.mjs",
            format: "esm",
            sourcemap: true,
            exports: "auto",
        }
    ],
    // json: templates/<id>.ts импортирует snapshots/*.json (sizeValues —
    // единая точка истины со схемой Avito). Без plugin'а rollup парсит .json
    // как JS и валится.
    plugins: [json(), esbuild()],
    external: [],
}, {
    input: `src/index.ts`,
    plugins: [json(), dts()],
    output: {
        file: `dist/bundle.d.ts`,
        format: 'es',
    },
}]

