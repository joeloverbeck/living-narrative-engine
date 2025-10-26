import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
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
