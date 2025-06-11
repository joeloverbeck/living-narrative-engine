// src/prompting/elementConditionEvaluator.js

/**
 * @module elementConditionEvaluator
 */

/**
 * @typedef {object} PromptElementCondition
 * @property {string} promptDataFlag - The key in promptData to check.
 * @property {*} [expectedValue] - The expected value for the flag. If omitted, truthiness of the flag is evaluated.
 */

/**
 * @typedef {Object.<string, any>} PromptData
 */

/**
 * Checks whether a given condition is met based on provided promptData.
 *
 * @param {PromptElementCondition} condition - The condition to evaluate.
 * @param {PromptData} promptData - An object containing the data flags and values.
 * @returns {boolean} True if the condition is met or no condition is given; otherwise false.
 */
export function isElementConditionMet(condition, promptData) {
  if (!condition) {
    return true;
  }
  const { promptDataFlag, expectedValue } = condition;
  if (typeof promptDataFlag !== 'string' || !promptDataFlag.trim()) {
    return false;
  }

  const actual = promptData[promptDataFlag];
  if (Object.prototype.hasOwnProperty.call(condition, 'expectedValue')) {
    return actual === expectedValue;
  }

  return Boolean(actual);
}
