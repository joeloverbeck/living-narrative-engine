import { freeze } from '../../utils/cloneUtils.js';

/**
 * @file Testing-specific DI tokens.
 * @typedef {string} DiToken
 */

/**
 * Tokens used by the testing facade subsystems.
 * These facades provide simplified interfaces for complex service interactions
 * in test environments, reducing test setup complexity by 60-70%.
 *
 * @type {Readonly<Record<string, DiToken>>}
 */
export const testingTokens = freeze({
  ILLMServiceFacade: 'ILLMServiceFacade',
  IActionServiceFacade: 'IActionServiceFacade',
  IEntityServiceFacade: 'IEntityServiceFacade',
  ITurnExecutionFacade: 'ITurnExecutionFacade',
});
