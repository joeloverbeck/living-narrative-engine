import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';

class MockEntity {
  constructor(id, nameComponentData = undefined, nameProp = undefined) {
    this.id = id;
    this._nameData = nameComponentData;
    if (nameProp !== undefined) {
      this.name = nameProp;
    }
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

  it('uses legacy value property with debug log', () => {
    const e = new MockEntity('e2', { value: 'Legacy' });
    expect(getEntityDisplayName(e, undefined, logger)).toBe('Legacy');
    expect(logger.debug).toHaveBeenCalledWith(
      `getEntityDisplayName: Entity 'e2' using legacy 'value' from '${NAME_COMPONENT_ID}' component.`
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('falls back to entity.name with debug log', () => {
    const e = new MockEntity('e3', { text: '' }, 'Fallback Name');
    expect(getEntityDisplayName(e, undefined, logger)).toBe('Fallback Name');
    expect(logger.debug).toHaveBeenCalledWith(
      `getEntityDisplayName: Entity 'e3' using fallback 'entity.name' property ('Fallback Name') as '${NAME_COMPONENT_ID}' was not found or lacked 'text'/'value'.`
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('falls back to entity id with warning', () => {
    const e = new MockEntity('e4');
    expect(getEntityDisplayName(e, undefined, logger)).toBe('e4');
    expect(logger.warn).toHaveBeenCalledWith(
      `getEntityDisplayName: Entity 'e4' has no usable name from component or 'entity.name'. Falling back to entity ID.`
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
