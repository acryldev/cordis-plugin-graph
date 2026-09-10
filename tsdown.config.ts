import { defineConfig } from 'tsdown'

const PACKAGE_NAME = 'cordis-plugin-graph'

export default defineConfig({
  name: `${PACKAGE_NAME}/client`,
  entry: { client: 'src/client/index.ts' },
  tsconfig: 'tsconfig.client.json',
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  fixedExtension: false,
  dts: false,
  clean: false,
  sourcemap: true,
  // cytoscape is bundled INTO client.js (real dsh-client bundle, not an
  // artifact - no CSP concern). Everything the Loader already provides on the
  // page stays external.
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/cordis-plugin-loader',
    '@deepseek-ai/dsh-client-ui-renderer/client',
    '@deepseek-ai/dsh-client-ui-settings/client',
    '@deepseek-ai/dsh-client-locale/client',
    '@deepseek-ai/dsh-client-ui-slots',
  ],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
