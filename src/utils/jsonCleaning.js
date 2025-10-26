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
//
// The previous implementation only matched lower-case "json"/"markdown" code
// fences. Many LLMs emit uppercase language identifiers (e.g. ```JSON) or
// variants like ```jsonc. When that happened, the wrapper survived the
// sanitisation step and the downstream JSON parser received the literal
// backticks, producing hard-to-diagnose parse errors. By making the language
// identifier optional, case-insensitive and tolerant of hyphenated or suffixed
// variants we correctly normalise a much wider set of LLM responses.
const MARKDOWN_WRAPPER_REGEX = /^```(?:[\w-]+)?\s*?\n?(.*?)\n?\s*?```$/is;

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
