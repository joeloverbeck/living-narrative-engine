/**
 * @file Unit tests ensuring validation type definitions module is executed
 * @description Provides coverage for src/validation/types.js which only exports
 * JSDoc typedefs used across the validation system.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

describe('validation type definitions module', () => {
  let typesModule;

  beforeAll(async () => {
    typesModule = await import('../../../cli/validation/types.js');
  });

  it('loads without exposing runtime exports', () => {
    expect(Object.keys(typesModule)).toHaveLength(0);
    expect('default' in typesModule).toBe(false);
  });

  it('returns the same module namespace on subsequent imports', async () => {
    const secondImport = await import('../../../cli/validation/types.js');
    expect(secondImport).toBe(typesModule);
  });

  it('behaves like an ECMAScript module namespace object', () => {
    expect(typesModule).not.toBeNull();
    expect(typeof typesModule).toBe('object');

    const tag = Object.prototype.toString.call(typesModule);
    expect(tag.toLowerCase()).toContain('object');
  });
});
