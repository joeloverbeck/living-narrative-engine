// src/utils/resolvePath.js
/**
 * Safely walks a dotted path inside a plain object.
 *
 * @param {object|null|undefined} root  – starting object
 * @param {string} dotPath              – e.g. "components.health.current"
 * @returns {*}                         – the value found, or undefined
 * @throws {TypeError} if dotPath is not a non-empty string
 */
export default function resolvePath(root, dotPath) {
  if (typeof dotPath !== 'string' || dotPath.trim() === '') {
    throw new TypeError('resolvePath: dotPath must be a non-empty string');
  }

  if (root === null || root === undefined) return undefined; // early null/undefined bail-out

  const segments = dotPath.trim().split('.');
  if (segments.some((seg) => seg === '')) {
    return undefined;
  }

  let current = root;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined; // any null/undefined hop → undefined
    current = current[segment];
  }
  return current;
}
