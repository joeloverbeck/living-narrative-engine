/**
 * @file Centralized repository for Dependency Injection (DI) keys/tokens.
 * Using tokens instead of raw strings prevents typos and aids refactoring.
 */

import { freeze } from '../utils/cloneUtils.js';
import { coreTokens } from './tokens/tokens-core.js';
import { uiTokens } from './tokens/tokens-ui.js';
import { aiTokens } from './tokens/tokens-ai.js';
import { testingTokens } from './tokens/tokens-testing.js';
import { pipelineTokens } from './tokens/tokens-pipeline.js';
import { actionTracingTokens } from './tokens/actionTracingTokens.js';
import { monitoringTokens } from './tokens/tokens-monitoring.js';

/**
 * @typedef {string} DiToken
 */

/**
 * All DI tokens used throughout the application.
 *
 * @type {Readonly<Record<string, DiToken>>}
 */
export const tokens = freeze({
  ...coreTokens,
  ...uiTokens,
  ...aiTokens,
  ...testingTokens,
  ...pipelineTokens,
  ...actionTracingTokens,
  ...monitoringTokens,
});
