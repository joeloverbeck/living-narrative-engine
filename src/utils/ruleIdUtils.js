/**
 * @file Utility functions for deriving rule IDs from filenames.
 */

/**
 * Derives the base rule ID from a filename by stripping directory segments,
 * extensions, and common rule-specific suffixes.
 *
 * @param {string} filename - The filename to parse.
 * @returns {string} The derived base ID, or an empty string if it cannot be determined.
 */
export function deriveBaseRuleIdFromFilename(filename) {
  if (typeof filename !== 'string') {
    return '';
  }
  let name = filename.trim();
  if (name === '') {
    return '';
  }

  // Normalize path separators and remove directories
  name = name.replace(/\\/g, '/');
  if (name.includes('/')) {
    name = name.substring(name.lastIndexOf('/') + 1);
  }

  // Remove the final extension
  if (name.includes('.')) {
    name = name.substring(0, name.lastIndexOf('.'));
  }

  // Remove common rule suffixes
  const suffixes = ['.rule', '.rule.json', '.rule.yml', '.rule.yaml'];
  for (const suffix of suffixes) {
    if (name.toLowerCase().endsWith(suffix)) {
      name = name.substring(0, name.length - suffix.length);
      break;
    }
  }

  return name;
}

export default deriveBaseRuleIdFromFilename;
