/**
 * @module jsonCleaning
 * @description Utilities for cleaning raw LLM JSON output strings.
 */

/**
 * List of common conversational prefixes to remove. Exported for reuse in tests.
 */
export const CONVERSATIONAL_PREFIXES = [
  'certainly, here is the json object:',
  'here is the json output:',
  'here is the json:',
  'here is your json:',
  "here's the json:",
  "okay, here's the json:",
  'sure, here is the json:',
  'the json response is:',
];

// Regex to identify and extract content from markdown code block wrappers.
const MARKDOWN_WRAPPER_REGEX = /^```(?:json|markdown)?\s*?\n?(.*?)\n?\s*?```$/s;

/**
 * Sanitizes raw string responses from LLMs by removing conversational prefixes and
 * markdown code block wrappers.
 *
 * @param {any} rawOutput - The raw output received from the LLM.
 * @returns {any} If `rawOutput` is a string, returns the cleaned string. Otherwise returns `rawOutput` unmodified.
 */
export function cleanLLMJsonOutput(rawOutput) {
  if (typeof rawOutput !== 'string') {
    return rawOutput;
  }

  let currentString = rawOutput.trim();

  for (const prefix of CONVERSATIONAL_PREFIXES) {
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^${escapedPrefix}\\s*`, 'i');

    if (prefixRegex.test(currentString)) {
      currentString = currentString.replace(prefixRegex, '');
      currentString = currentString.trim();
      break;
    }
  }

  const match = currentString.match(MARKDOWN_WRAPPER_REGEX);
  if (match && typeof match[1] === 'string') {
    currentString = match[1];
  }

  return currentString.trim();
}
