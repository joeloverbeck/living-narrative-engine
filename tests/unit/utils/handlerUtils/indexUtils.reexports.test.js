import * as indexUtils from '../../../../src/utils/handlerUtils/indexUtils.js';
import { assertParamsObject } from '../../../../src/utils/handlerUtils/paramsUtils.js';
import {
  initHandlerLogger,
  validateServiceDeps,
  resolveExecutionLogger,
} from '../../../../src/utils/serviceInitializerUtils.js';

describe('handlerUtils/indexUtils exports', () => {
  it('re-exports helper utilities without modification', () => {
    expect(indexUtils.assertParamsObject).toBe(assertParamsObject);
    expect(indexUtils.initHandlerLogger).toBe(initHandlerLogger);
    expect(indexUtils.validateDeps).toBe(validateServiceDeps);
    expect(indexUtils.resolveExecutionLogger).toBe(resolveExecutionLogger);
  });

  it('exposes only the expected named exports', () => {
    expect(Object.keys(indexUtils).sort()).toEqual(
      ['assertParamsObject', 'initHandlerLogger', 'resolveExecutionLogger', 'validateDeps'].sort(),
    );
  });
});
