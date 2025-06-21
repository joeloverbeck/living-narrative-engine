/* eslint-env node */
/* global module */

/**
 * @description Babel configuration used by Jest and the build step.
 * @type {import('@babel/core').TransformOptions}
 */
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
