import { describe, test, expect, jest } from '@jest/globals';
import { _checkVersionCompatibility } from '../../../src/modding/modDependencyValidator.js';

const createLogger = () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('_checkVersionCompatibility', () => {
  test('records fatal when required dependency has invalid target version', () => {
    const logger = createLogger();
    const fatals = [];
    const semverLib = {
      valid: jest.fn(() => false),
      validRange: jest.fn(),
      satisfies: jest.fn(),
    };
    _checkVersionCompatibility(
      { id: 'B', version: '^1.0.0', _hostId: 'A' },
      { id: 'B', version: 'bad' },
      true,
      logger,
      fatals,
      semverLib
    );
    expect(fatals[0]).toMatch(/invalid version format/);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('warns when optional dependency has invalid version range', () => {
    const logger = createLogger();
    const fatals = [];
    const semverLib = {
      valid: jest.fn(() => true),
      validRange: jest.fn(() => false),
      satisfies: jest.fn(),
    };
    _checkVersionCompatibility(
      { id: 'B', version: '>=x', _hostId: 'A' },
      { id: 'B', version: '1.0.0' },
      false,
      logger,
      fatals,
      semverLib
    );
    expect(fatals).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/invalid version range/)
    );
  });

  test('records fatal when versions do not satisfy required range', () => {
    const logger = createLogger();
    const fatals = [];
    const semverLib = {
      valid: jest.fn(() => true),
      validRange: jest.fn(() => true),
      satisfies: jest.fn(() => false),
    };
    _checkVersionCompatibility(
      { id: 'B', version: '^2.0.0', _hostId: 'A' },
      { id: 'B', version: '1.0.0' },
      true,
      logger,
      fatals,
      semverLib
    );
    expect(fatals[0]).toMatch(/requires dependency/);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('passes silently when versions satisfy', () => {
    const logger = createLogger();
    const fatals = [];
    const semverLib = {
      valid: jest.fn(() => true),
      validRange: jest.fn(() => true),
      satisfies: jest.fn(() => true),
    };
    _checkVersionCompatibility(
      { id: 'B', version: '^1.0.0', _hostId: 'A' },
      { id: 'B', version: '1.1.0' },
      true,
      logger,
      fatals,
      semverLib
    );
    expect(fatals).toHaveLength(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
