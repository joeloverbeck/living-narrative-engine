import { describe, it, expect } from '@jest/globals';
import { registerWithLog } from '../../../src/utils/registrarHelpers.js';
import { createMockLogger } from '../testUtils.js';

/**
 * @description Unit tests for the registerWithLog utility covering both call
 * signatures and error handling paths.
 */

describe('registerWithLog', () => {
  it('invokes registrar method when logger is first param', () => {
    const registrar = { custom: jest.fn() };
    const logger = createMockLogger();
    registerWithLog(registrar, logger, 'custom', 'tok', 1, 2);
    expect(registrar.custom).toHaveBeenCalledWith('tok', 1, 2);
    expect(logger.debug).toHaveBeenCalledWith(
      'UI Registrations: Registered tok.'
    );
  });

  it('throws when method name is invalid', () => {
    const registrar = {};
    const logger = createMockLogger();
    expect(() => registerWithLog(registrar, logger, 'missing', 'tok')).toThrow(
      'Unknown registrar method: missing'
    );
  });

  it('uses register signature and logs when logger provided', () => {
    const registrar = { register: jest.fn() };
    const logger = createMockLogger();
    registerWithLog(registrar, 'tok', 'val', { opt: true }, logger);
    expect(registrar.register).toHaveBeenCalledWith('tok', 'val', {
      opt: true,
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'UI Registrations: Registered tok.'
    );
  });

  it('skips logging when logger lacks debug', () => {
    const registrar = { register: jest.fn() };
    const logger = {};
    registerWithLog(registrar, 'tok', 'val', {}, logger);
    expect(registrar.register).toHaveBeenCalledWith('tok', 'val', {});
  });
});
