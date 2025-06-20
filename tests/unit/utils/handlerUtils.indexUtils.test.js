import { describe, it, expect } from '@jest/globals';
import indexUtils, {
  assertParamsObject,
  initHandlerLogger,
  validateDeps,
  getExecLogger,
} from '../../../src/utils/handlerUtils/indexUtils.js';
import { assertParamsObject as paramsAssert } from '../../../src/utils/handlerUtils/paramsUtils.js';
import {
  initHandlerLogger as serviceInit,
  validateDeps as serviceValidate,
  getExecLogger as serviceGetExec,
} from '../../../src/utils/handlerUtils/serviceUtils.js';

describe('handlerUtils/indexUtils exports', () => {
  it('re-exports functions from paramsUtils and serviceUtils', () => {
    expect(assertParamsObject).toBe(paramsAssert);
    expect(initHandlerLogger).toBe(serviceInit);
    expect(validateDeps).toBe(serviceValidate);
    expect(getExecLogger).toBe(serviceGetExec);
  });

  it('default export contains same references', () => {
    expect(indexUtils).toEqual({
      assertParamsObject: paramsAssert,
      initHandlerLogger: serviceInit,
      validateDeps: serviceValidate,
      getExecLogger: serviceGetExec,
    });
  });
});
