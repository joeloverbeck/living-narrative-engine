import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ModDependencyValidator from '../../../src/modding/modDependencyValidator.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createManifestMap = (arr) => {
  const map = new Map();
  for (const m of arr) {
    map.set(m.id.toLowerCase(), m);
  }
  return map;
};

describe('ModDependencyValidator invalid range handling', () => {
  let logger;
  beforeEach(() => {
    logger = createMockLogger();
    jest.clearAllMocks();
  });

  it('throws when required dependency has invalid version range', () => {
    const modB = { id: 'ModB', version: '1.0.0' };
    const modA = {
      id: 'ModA',
      version: '1.0.0',
      dependencies: [{ id: 'ModB', version: '>=foo', required: true }],
    };
    const manifests = createManifestMap([modA, modB]);
    expect(() => ModDependencyValidator.validate(manifests, logger)).toThrow(
      ModDependencyError
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns when optional dependency has invalid version range', () => {
    const modB = { id: 'ModB', version: '1.0.0' };
    const modA = {
      id: 'ModA',
      version: '1.0.0',
      dependencies: [{ id: 'ModB', version: '~invalid', required: false }],
    };
    const manifests = createManifestMap([modA, modB]);
    expect(() =>
      ModDependencyValidator.validate(manifests, logger)
    ).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/invalid version range/)
    );
  });
});
