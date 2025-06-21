// tests/utils/entityValidationUtils.test.js

import { describe, it, expect } from '@jest/globals';
import {
  isValidEntity,
  isValidEntityManager,
} from '../../../src/utils/entityValidationUtils.js';

describe('isValidEntity', () => {
  it('returns true for an object with getComponentData function', () => {
    const entity = { getComponentData: () => {} };
    expect(isValidEntity(entity)).toBe(true);
  });

  it('returns false for null or undefined', () => {
    expect(isValidEntity(null)).toBe(false);
    expect(isValidEntity(undefined)).toBe(false);
  });

  it('returns false when getComponentData is missing', () => {
    const entity = { id: 'e1' };
    expect(isValidEntity(entity)).toBe(false);
  });
});

describe('isValidEntityManager', () => {
  it('returns true when required methods exist', () => {
    const manager = {
      getEntityInstance: () => {},
      getComponentData: () => {},
    };
    expect(isValidEntityManager(manager)).toBe(true);
  });

  it('returns false when any required method is missing', () => {
    const missingGetInstance = { getComponentData: () => {} };
    const missingGetComponent = { getEntityInstance: () => {} };
    expect(isValidEntityManager(missingGetInstance)).toBe(false);
    expect(isValidEntityManager(missingGetComponent)).toBe(false);
  });

  it('returns false for null or undefined', () => {
    expect(isValidEntityManager(null)).toBe(false);
    expect(isValidEntityManager(undefined)).toBe(false);
  });
});
