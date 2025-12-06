import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';

const INDEX_UTILS_PATH = '../../../../src/utils/handlerUtils/indexUtils.js';
const PARAMS_UTILS_PATH = '../../../../src/utils/handlerUtils/paramsUtils.js';
const SERVICE_INITIALIZER_UTILS_PATH =
  '../../../../src/utils/serviceInitializerUtils.js';

describe('utils/handlerUtils/indexUtils re-export wiring', () => {
  /** @type {typeof import(PARAMS_UTILS_PATH)} */
  let paramsUtils;
  /** @type {typeof import(SERVICE_INITIALIZER_UTILS_PATH)} */
  let serviceInitializerUtils;
  /** @type {typeof import(INDEX_UTILS_PATH)} */
  let moduleNamespace;

  beforeAll(async () => {
    jest.resetModules();

    paramsUtils = await import(PARAMS_UTILS_PATH);
    serviceInitializerUtils = await import(SERVICE_INITIALIZER_UTILS_PATH);
    moduleNamespace = await import(INDEX_UTILS_PATH);
  });

  afterAll(() => {
    jest.resetModules();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('re-exports helper functions from paramsUtils and serviceInitializerUtils', () => {
    expect(moduleNamespace.assertParamsObject).toBe(
      paramsUtils.assertParamsObject
    );
    expect(moduleNamespace.initHandlerLogger).toBe(
      serviceInitializerUtils.initHandlerLogger
    );
    expect(moduleNamespace.validateDeps).toBe(
      serviceInitializerUtils.validateServiceDeps
    );
    expect(moduleNamespace.resolveExecutionLogger).toBe(
      serviceInitializerUtils.resolveExecutionLogger
    );
  });

  it('only exposes the documented named exports', () => {
    const exportedKeys = Object.keys(moduleNamespace).sort();
    expect(exportedKeys).toEqual([
      'assertParamsObject',
      'initHandlerLogger',
      'resolveExecutionLogger',
      'validateDeps',
    ]);
  });

  it('delegates validateDeps calls to validateServiceDeps with original arguments', () => {
    const spy = jest.spyOn(serviceInitializerUtils, 'validateServiceDeps');
    const deps = { cache: { value: 'example' } };

    moduleNamespace.validateDeps('ExampleService', 'logger', deps);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('ExampleService', 'logger', deps);
  });
});

describe('utils/handlerUtils/indexUtils actual exports', () => {
  it('provides concrete implementations when imported without mocks', async () => {
    await jest.isolateModulesAsync(async () => {
      const actualModule = await import(INDEX_UTILS_PATH);

      expect(typeof actualModule.assertParamsObject).toBe('function');
      expect(typeof actualModule.initHandlerLogger).toBe('function');
      expect(typeof actualModule.validateDeps).toBe('function');
      expect(typeof actualModule.resolveExecutionLogger).toBe('function');
    });
  });
});
