import { describe, it, expect } from '@jest/globals';
import {
  createDefaultOptions,
  createQueryOptions,
  createModificationOptions,
  createBulkOptions,
  createValidationOptions,
  createDescriptionOptions,
  mergeOptions,
  validateOptions,
} from '../../../../../src/shared/facades/types/FacadeOptions.js';

describe('FacadeOptions utilities', () => {
  it('creates base options with overrides without mutating defaults', () => {
    const overrides = {
      cache: false,
      metadata: { source: 'test' },
      timeout: 5000,
    };
    const result = createDefaultOptions(overrides);

    expect(result).toMatchObject({
      cache: false,
      validate: true,
      metadata: { source: 'test' },
      timeout: 5000,
    });
    expect(result.metadata).toBe(overrides.metadata);
  });

  it('creates query options with expected defaults and merges overrides', () => {
    const result = createQueryOptions({
      sortOrder: 'desc',
      limit: 25,
      cache: false,
    });

    expect(result).toMatchObject({
      cache: false,
      validate: true,
      includeMetadata: false,
      sortOrder: 'desc',
      limit: 25,
    });
  });

  it('creates modification and bulk options layering defaults correctly', () => {
    const modification = createModificationOptions({
      force: true,
      cascade: false,
    });
    expect(modification).toMatchObject({
      cache: true,
      validate: true,
      force: true,
      cascade: false,
      notifyOnChange: true,
    });

    const bulk = createBulkOptions({
      batchSize: 50,
      parallel: true,
      force: true,
    });
    expect(bulk).toMatchObject({
      batchSize: 50,
      parallel: true,
      force: true,
      notifyOnChange: true,
      stopOnError: true,
      returnResults: false,
    });
  });

  it('creates validation and description options with sensible defaults', () => {
    const validation = createValidationOptions({
      level: 'moderate',
      includeWarnings: true,
    });
    expect(validation).toMatchObject({
      cache: true,
      validate: true,
      level: 'moderate',
      includeWarnings: true,
      fixIssues: false,
    });

    const description = createDescriptionOptions({
      style: 'detailed',
      includeContext: false,
    });
    expect(description).toMatchObject({
      style: 'detailed',
      perspective: 'third-person',
      includeContext: false,
      detailLevel: 'medium',
    });
  });

  it('merges multiple option objects while ignoring non-object entries', () => {
    const options = mergeOptions(
      { cache: true, limit: 10 },
      null,
      { limit: 5, sortOrder: 'desc' },
      'ignored',
      { filters: { status: 'active' } }
    );

    expect(options).toEqual({
      cache: true,
      limit: 5,
      sortOrder: 'desc',
      filters: { status: 'active' },
    });
  });

  it('validates options against schema returning success when constraints are met', () => {
    const schema = {
      required: ['cache', 'level'],
      types: { cache: 'boolean', metadata: 'object', attempts: 'number' },
      allowedValues: {
        level: ['strict', 'moderate'],
        sortOrder: ['asc', 'desc'],
      },
    };

    const { valid, errors } = validateOptions(
      {
        cache: false,
        metadata: null,
        level: 'strict',
        sortOrder: 'asc',
        attempts: 0,
      },
      schema
    );

    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('collects validation issues for missing fields, type mismatches, and invalid values', () => {
    const schema = {
      required: ['cache'],
      types: { cache: 'boolean', metadata: 'object' },
      allowedValues: { level: ['strict', 'moderate'] },
    };

    const { valid, errors } = validateOptions(
      {
        cache: 'yes',
        metadata: 'not-object',
        level: 'extreme',
      },
      schema
    );

    expect(valid).toBe(false);
    expect(errors).toEqual(
      expect.arrayContaining([
        'Option cache must be of type boolean, got string',
        'Option metadata must be of type object, got string',
        'Option level must be one of: strict, moderate',
      ])
    );
  });

  it('reports when the options value is not an object', () => {
    const result = validateOptions(null, { required: ['cache'] });
    expect(result).toEqual({
      valid: false,
      errors: ['Options must be an object'],
    });
  });
});
