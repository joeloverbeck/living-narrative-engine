/**
 * @file Helpers for expression integration tests.
 */

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
