/**
 * @file Helper to build modal element configuration objects.
 */

/**
 * @typedef {import('../boundDomRendererBase.js').ElementsConfig} ElementsConfig
 */

/**
 * @description Creates an {@link ElementsConfig} object using selector strings.
 * Values in `selectors` can be either a selector string or a tuple of
 * `[selector, expectedType]` where `expectedType` is a constructor function used
 * for type validation in {@link BoundDomRendererBase}.
 * @param {Object.<string, string | [string, Function]>} selectors
 * Map of element keys to selector values.
 * @returns {ElementsConfig} Config object suitable for BoundDomRendererBase.
 */
export function buildModalElementsConfig(selectors) {
  const config = {};
  for (const [key, value] of Object.entries(selectors)) {
    if (!value) continue;
    if (typeof value === 'string') {
      config[key] = { selector: value, required: true };
    } else if (Array.isArray(value)) {
      const [selector, expectedType] = value;
      config[key] = { selector, required: true };
      if (expectedType) {
        config[key].expectedType = expectedType;
      }
    }
  }
  return config;
}
