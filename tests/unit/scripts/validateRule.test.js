import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

const SCRIPT_PATH = '../../../validate-rule.js';

/**
 * Helper to load the script with mocked dependencies.
 *
 * @param {object} options
 * @param {boolean} options.valid - Whether the mocked Ajv validation should pass.
 * @param {Array<object>} [options.errors] - Errors to expose on the Ajv instance when validation fails.
 * @returns {{ exitSpy: jest.SpiedFunction<typeof process.exit>, logSpy: jest.SpiedFunction<typeof console.log>, validateMock: jest.Mock, ajvCtorMock: jest.Mock }}
 */
function loadScript({ valid, errors = [] } = { valid: true }) {
  jest.resetModules();

  const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined);
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  const validateMock = jest.fn().mockImplementation(() => valid);
  const ajvInstance = { validate: validateMock, errors };
  const ajvCtorMock = jest.fn(() => ajvInstance);

  jest.doMock('ajv', () => ({ default: ajvCtorMock }), { virtual: true });

  jest.isolateModules(() => {
    // Requiring the script executes it immediately with the mocked dependencies.
    require(SCRIPT_PATH);
  });

  return { exitSpy, logSpy, validateMock, ajvCtorMock, ajvInstance };
}

describe('validate-rule.js CLI script', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('ajv');
    jest.restoreAllMocks();
  });

  it('prints a success message when the rule validates', () => {
    const { exitSpy, logSpy, validateMock, ajvCtorMock } = loadScript({ valid: true });

    const expectedSchema = require('../../../data/schemas/rule.schema.json');
    const expectedRule = require('../../../data/mods/items/rules/handle_take_from_container.rule.json');

    expect(ajvCtorMock).toHaveBeenCalledTimes(1);
    expect(validateMock).toHaveBeenCalledTimes(1);
    expect(validateMock).toHaveBeenCalledWith(expectedSchema, expectedRule);

    const [firstCall] = logSpy.mock.calls;
    expect(firstCall).toEqual(['Rule is VALID']);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('reports validation failures and exits with status code 1', () => {
    const errors = [{ instancePath: '/slot', message: 'should be string' }];
    const { exitSpy, logSpy, validateMock } = loadScript({ valid: false, errors });

    const expectedSchema = require('../../../data/schemas/rule.schema.json');
    const expectedRule = require('../../../data/mods/items/rules/handle_take_from_container.rule.json');

    expect(validateMock).toHaveBeenCalledTimes(1);
    expect(validateMock).toHaveBeenCalledWith(expectedSchema, expectedRule);
    expect(logSpy).toHaveBeenNthCalledWith(1, 'INVALID RULE:');
    expect(logSpy).toHaveBeenNthCalledWith(2, JSON.stringify(errors, null, 2));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
