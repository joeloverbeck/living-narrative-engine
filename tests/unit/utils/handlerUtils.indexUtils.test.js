import { describe, it, expect } from '@jest/globals';
import {
  assertParamsObject,
  initHandlerLogger,
  validateDeps,
  resolveExecutionLogger,
} from '../../../src/utils/handlerUtils/indexUtils.js';
import { assertParamsObject as paramsAssert } from '../../../src/utils/handlerUtils/paramsUtils.js';
import {
  initHandlerLogger as serviceInit,
  validateServiceDeps as serviceValidate,
  resolveExecutionLogger as serviceGetExec,
} from '../../../src/utils/serviceInitializerUtils.js';

describe('handlerUtils/indexUtils exports', () => {
  it('re-exports functions from paramsUtils and serviceInitializerUtils', () => {
    expect(assertParamsObject).toBe(paramsAssert);
    expect(initHandlerLogger).toBe(serviceInit);
    expect(validateDeps).toBe(serviceValidate);
    expect(resolveExecutionLogger).toBe(serviceGetExec);
  });
});
