import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getEntityDisplayName,
  extractEntityId,
} from '../../../src/utils/entityUtils.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';

class MockEntity {
  constructor(id, nameComponentData = undefined) {
    this.id = id;
    this._nameData = nameComponentData;
  }

  getComponentData(type) {
    if (type === NAME_COMPONENT_ID) return this._nameData;
    return undefined;
  }
}

const logger = {
  debug: jest.fn(),
  warn: jest.fn(),
};

beforeEach(() => {
  logger.debug.mockClear();
  logger.warn.mockClear();
});

describe('getEntityDisplayName', () => {
  it('returns text from core:name component', () => {
    const e = new MockEntity('e1', { text: 'Hero' });
    expect(getEntityDisplayName(e, undefined, logger)).toBe('Hero');
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("falls back to legacy 'value' property when text is unavailable", () => {
    const e = new MockEntity('legacy-1', { value: 'Legacy Hero' });
    expect(getEntityDisplayName(e, undefined, logger)).toBe('Legacy Hero');
    expect(logger.debug).toHaveBeenCalledWith(
      `getEntityDisplayName: Using legacy 'value' property from '${NAME_COMPONENT_ID}' component for entity 'legacy-1'.`
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('falls back to entity.id when name component is empty', () => {
    const e = new MockEntity('e3', { text: '' });
    expect(getEntityDisplayName(e, undefined, logger)).toBe('e3');
    expect(logger.warn).toHaveBeenCalledWith(
      `getEntityDisplayName: Entity 'e3' has no usable name from '${NAME_COMPONENT_ID}' component. Falling back to entity ID.`
    );
  });

  it('falls back to entity id with warning', () => {
    const e = new MockEntity('e4');
    expect(getEntityDisplayName(e, undefined, logger)).toBe('e4');
    expect(logger.warn).toHaveBeenCalledWith(
      `getEntityDisplayName: Entity 'e4' has no usable name from '${NAME_COMPONENT_ID}' component. Falling back to entity ID.`
    );
  });

  it('handles invalid entity and returns fallback', () => {
    expect(getEntityDisplayName(null, 'n/a', logger)).toBe('n/a');
    expect(logger.debug).toHaveBeenCalledWith(
      'getEntityDisplayName: Received invalid or non-entity object (ID: N/A). Using fallbackString.'
    );
  });

  it('handles object lacking getComponentData but with id', () => {
    const obj = { id: 'x1' };
    expect(getEntityDisplayName(obj, 'n/a', logger)).toBe('x1');
    expect(logger.debug).toHaveBeenCalledWith(
      'getEntityDisplayName: Received invalid or non-entity object (ID: x1). Using ID.'
    );
  });
});

describe('extractEntityId', () => {
  it('returns string ID when given a string', () => {
    expect(extractEntityId('actor-123')).toBe('actor-123');
  });

  it('returns undefined for empty string (empty string is not a valid entity ID)', () => {
    expect(extractEntityId('')).toBeUndefined();
  });

  it('returns id property when given an entity object', () => {
    const entity = { id: 'actor-456', name: 'Test Entity' };
    expect(extractEntityId(entity)).toBe('actor-456');
  });

  it('returns id property when given a MockEntity', () => {
    const entity = new MockEntity('mock-entity-1');
    expect(extractEntityId(entity)).toBe('mock-entity-1');
  });

  it('returns undefined for null', () => {
    expect(extractEntityId(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(extractEntityId(undefined)).toBeUndefined();
  });

  it('returns undefined for objects without id property', () => {
    expect(extractEntityId({ name: 'test' })).toBeUndefined();
  });

  it('returns undefined for objects with non-string id', () => {
    expect(extractEntityId({ id: 123 })).toBeUndefined();
    expect(extractEntityId({ id: null })).toBeUndefined();
    expect(extractEntityId({ id: { nested: 'value' } })).toBeUndefined();
  });

  it('returns undefined for number inputs', () => {
    expect(extractEntityId(123)).toBeUndefined();
  });

  it('returns undefined for boolean inputs', () => {
    expect(extractEntityId(true)).toBeUndefined();
    expect(extractEntityId(false)).toBeUndefined();
  });

  it('returns undefined for array inputs', () => {
    expect(extractEntityId(['actor-1'])).toBeUndefined();
  });
});
