import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActiveModsManifestBuilder from '../../../src/persistence/activeModsManifestBuilder.js';
import { CORE_MOD_ID } from '../../../src/constants/core.js';

describe('ActiveModsManifestBuilder', () => {
  let logger;
  let dataRegistry;
  let builder;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    dataRegistry = { getAll: jest.fn() };
    builder = new ActiveModsManifestBuilder({ logger, dataRegistry });
  });

  it('returns manifest from registry when available', () => {
    dataRegistry.getAll.mockReturnValue([
      { id: 'core', version: '1.0.0' },
      { id: 'mod2', version: '2.3.4' },
    ]);
    const result = builder.buildManifest();
    expect(result).toEqual([
      { modId: 'core', version: '1.0.0' },
      { modId: 'mod2', version: '2.3.4' },
    ]);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('falls back to core mod version when registry empty', () => {
    dataRegistry.getAll.mockReturnValue([]);
    const result = builder.buildManifest();
    expect(result).toEqual([
      { modId: CORE_MOD_ID, version: 'unknown_fallback' },
    ]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('uses core mod version from registry when present', () => {
    dataRegistry.getAll.mockReturnValue([
      { id: CORE_MOD_ID, version: '2.0.0' },
    ]);
    const result = builder.buildManifest();
    expect(result).toEqual([{ modId: CORE_MOD_ID, version: '2.0.0' }]);
  });

  it('handles missing registry gracefully', () => {
    dataRegistry.getAll.mockReturnValue(undefined);
    const result = builder.buildManifest();
    expect(result).toEqual([
      { modId: CORE_MOD_ID, version: 'unknown_fallback' },
    ]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('uses core mod version when list length is 0 but find returns value', () => {
    const trickyList = {
      length: 0,
      find: () => ({ id: CORE_MOD_ID, version: '3.3.3' }),
    };
    dataRegistry.getAll.mockReturnValue(trickyList);
    const result = builder.buildManifest();
    expect(result).toEqual([{ modId: CORE_MOD_ID, version: '3.3.3' }]);
    expect(logger.debug).toHaveBeenCalled();
  });
});
