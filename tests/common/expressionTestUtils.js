/**
 * @file Helpers for expression integration tests.
 */

/**
 * Default sexual state keys for tests where expressions don't reference sexual states.
 * These are arbitrary test values for mock consistency; production keys differ
 * (see core:sexual_prototypes lookup for actual prototype names like sexual_lust, passion, etc.).
 */
export const DEFAULT_SEXUAL_KEYS = [
  'sex_excitation',
  'sex_inhibition',
  'baseline_libido',
];

/**
 * Default emotion keys for tests.
 * These represent a minimal subset for mock consistency; production lookup
 * contains ~70+ emotions (see core:emotion_prototypes).
 */
export const DEFAULT_EMOTION_KEYS = [
  'joy',
  'sadness',
  'anger',
  'fear',
  'disgust',
  'surprise',
];

/**
 * Ensures prototype keys array is non-empty, using fallback if needed.
 * Use this when collectExpressionStateKeys() returns empty arrays because
 * the expressions being tested don't reference certain state variables.
 *
 * @param {string[]} collectedKeys - Keys collected from expressions
 * @param {string[]} fallbackKeys - Fallback keys if collected is empty
 * @returns {string[]} Non-empty key array
 */
export const ensurePrototypeKeys = (collectedKeys, fallbackKeys) => {
  if (collectedKeys && collectedKeys.length > 0) {
    return collectedKeys;
  }
  return fallbackKeys;
};

const extractStateKey = (variable, prefix) => {
  if (typeof variable !== 'string') {
    return null;
  }

  if (!variable.startsWith(prefix)) {
    return null;
  }

  return variable.slice(prefix.length);
};

const walkPrerequisites = (node, emotionKeys, sexualKeys) => {
  if (Array.isArray(node)) {
    node.forEach((child) => walkPrerequisites(child, emotionKeys, sexualKeys));
    return;
  }

  if (!node || typeof node !== 'object') {
    return;
  }

  if (Object.prototype.hasOwnProperty.call(node, 'var')) {
    const variable = node.var;
    const emotionKey = extractStateKey(variable, 'emotions.');
    if (emotionKey) {
      emotionKeys.add(emotionKey);
    }

    const sexualKey = extractStateKey(variable, 'sexualStates.');
    if (sexualKey) {
      sexualKeys.add(sexualKey);
    }
  }

  Object.values(node).forEach((value) => {
    walkPrerequisites(value, emotionKeys, sexualKeys);
  });
};

export const collectExpressionStateKeys = (expressions) => {
  const emotionKeys = new Set();
  const sexualKeys = new Set();

  expressions.forEach((expression) => {
    walkPrerequisites(expression, emotionKeys, sexualKeys);
  });

  return {
    emotionKeys: Array.from(emotionKeys),
    sexualKeys: Array.from(sexualKeys),
  };
};

export const buildStateMap = (keys, overrides = {}) => {
  return new Map(keys.map((key) => [key, overrides[key] ?? 0]));
};
