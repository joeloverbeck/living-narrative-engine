/* eslint-env node */

/**
 * @description Babel configuration used by Jest and the build step.
 * @type {import('@babel/core').TransformOptions}
 */
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
