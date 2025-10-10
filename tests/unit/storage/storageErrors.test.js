import { describe, expect, it } from '@jest/globals';
import StorageErrorCodes, {
  StorageErrorCodes as namedExport,
} from '../../../src/storage/storageErrors.js';

const MODULE_PATH = '../../../src/storage/storageErrors.js';

describe('storageErrors module', () => {
  it('exposes matching default and named exports', () => {
    expect(StorageErrorCodes).toBe(namedExport);
    expect(StorageErrorCodes).toEqual({
      DISK_FULL: 'DISK_FULL',
      FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    });
  });

  it('prevents mutation of the exported error codes', () => {
    expect(Object.isFrozen(StorageErrorCodes)).toBe(true);

    expect(() => {
      StorageErrorCodes.DISK_FULL = 'UPDATED';
    }).toThrow(TypeError);

    expect(StorageErrorCodes.DISK_FULL).toBe('DISK_FULL');
  });

  it('provides stable enumeration semantics', () => {
    expect(Object.keys(StorageErrorCodes).sort()).toEqual([
      'DISK_FULL',
      'FILE_NOT_FOUND',
    ]);

    expect(Object.values(StorageErrorCodes)).toEqual([
      'DISK_FULL',
      'FILE_NOT_FOUND',
    ]);
  });

  it('supports dynamic imports with the frozen singleton instance', async () => {
    const moduleNamespace = await import(MODULE_PATH);
    expect(moduleNamespace.StorageErrorCodes).toBe(StorageErrorCodes);
    expect(moduleNamespace.default).toBe(StorageErrorCodes);
  });
});
