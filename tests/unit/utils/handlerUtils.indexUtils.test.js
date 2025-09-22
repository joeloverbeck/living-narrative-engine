import { describe, it, expect } from '@jest/globals';

import {
  assertParamsObject as exportedAssertParamsObject,
  initHandlerLogger as exportedInitHandlerLogger,
  validateDeps as exportedValidateDeps,
  resolveExecutionLogger as exportedResolveExecutionLogger,
} from '../../../src/utils/handlerUtils/indexUtils.js';

import { assertParamsObject as sourceAssertParamsObject } from '../../../src/utils/handlerUtils/paramsUtils.js';
import {
  initHandlerLogger as sourceInitHandlerLogger,
  validateServiceDeps,
  resolveExecutionLogger as sourceResolveExecutionLogger,
} from '../../../src/utils/serviceInitializerUtils.js';

describe('handlerUtils/indexUtils re-exports', () => {
  it('re-exports assertParamsObject directly from paramsUtils', () => {
    expect(exportedAssertParamsObject).toBe(sourceAssertParamsObject);
  });

  it('re-exports initHandlerLogger directly from serviceInitializerUtils', () => {
    expect(exportedInitHandlerLogger).toBe(sourceInitHandlerLogger);
  });

  it('re-exports validateServiceDeps as validateDeps alias', () => {
    expect(exportedValidateDeps).toBe(validateServiceDeps);
  });

  it('re-exports resolveExecutionLogger directly from serviceInitializerUtils', () => {
    expect(exportedResolveExecutionLogger).toBe(sourceResolveExecutionLogger);
  });
});
