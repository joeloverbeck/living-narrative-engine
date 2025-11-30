import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../../../../common/entities/testBed.js';

describe('locks:openable Component', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBedClass();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('validates minimal locked blocker data with a required key', () => {
    const data = {
      isLocked: true,
      requiredKeyId: 'items:brass_key',
    };

    const result = testBed.validateAgainstSchema(data, 'locks:openable');
    expect(result.isValid).toBe(true);
  });

  it('accepts optional open state, label, and lastChangedBy fields', () => {
    const data = {
      isLocked: false,
      isOpen: true,
      requiredKeyId: 'items:master_key',
      lockLabel: 'Steel vault lock',
      lastChangedBy: 'core:actor_123',
    };

    const result = testBed.validateAgainstSchema(data, 'locks:openable');
    expect(result.isValid).toBe(true);
  });

  it('rejects missing requiredKeyId', () => {
    const data = {
      isLocked: true,
    };

    const result = testBed.validateAgainstSchema(data, 'locks:openable');
    expect(result.isValid).toBe(false);
  });

  it('rejects malformed requiredKeyId namespaces', () => {
    const data = {
      isLocked: true,
      requiredKeyId: 'brass_key',
    };

    const result = testBed.validateAgainstSchema(data, 'locks:openable');
    expect(result.isValid).toBe(false);
  });

  it('rejects unexpected properties', () => {
    const data = {
      isLocked: true,
      requiredKeyId: 'items:brass_key',
      unexpected: 'extra',
    };

    const result = testBed.validateAgainstSchema(data, 'locks:openable');
    expect(result.isValid).toBe(false);
  });
});
