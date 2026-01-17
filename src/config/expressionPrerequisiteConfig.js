/**
 * @file Configuration for expression prerequisite evaluation.
 */

import { getBooleanEnvironmentVariable } from '../utils/environmentUtils.js';

const STRICT_ENV_KEY = 'EXPRESSION_PREREQ_STRICT';

/**
 * @returns {{strictMode: boolean}}
 */
export function getExpressionPrerequisiteConfig() {
  return {
    strictMode: getBooleanEnvironmentVariable(STRICT_ENV_KEY, false),
  };
}

/**
 * @returns {boolean} True when strict prerequisite evaluation is enabled.
 */
export function isExpressionPrerequisiteStrictModeEnabled() {
  return getExpressionPrerequisiteConfig().strictMode;
}
