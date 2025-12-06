/* eslint-env node */
/* global module */

/**
 * @description Babel configuration used by Jest and the build step.
 * @type {import('@babel/core').TransformOptions}
 */
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: ['@babel/plugin-syntax-import-assertions'],
  env: {
    test: {
      plugins: [
        '@babel/plugin-syntax-import-assertions',
        'babel-plugin-transform-import-meta',
      ],
    },
  },
};
