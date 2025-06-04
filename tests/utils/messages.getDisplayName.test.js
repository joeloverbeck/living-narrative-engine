import { describe, it, expect } from '@jest/globals';
import { getDisplayName } from '../../src/utils/messages.js';

// Minimal mock entity class for tests
class MockEntity {
  constructor(id, nameComponentData = undefined, nameProp = undefined) {
    this.id = id;
    this._nameData = nameComponentData;
    if (nameProp !== undefined) {
      this.name = nameProp;
    }
  }
  getComponentData(type) {
    if (type === 'core:name') return this._nameData;
    return undefined;
  }
}

describe('getDisplayName', () => {
  it('uses text property from core:name component when available', () => {
    const entity = new MockEntity('e1', { text: 'Hero' });
    expect(getDisplayName(entity)).toBe('Hero');
  });

  it('falls back to value property if text is missing', () => {
    const entity = new MockEntity('e2', { value: 'LegacyName' });
    expect(getDisplayName(entity)).toBe('LegacyName');
  });

  it('falls back to entity.id when name component missing', () => {
    const entity = new MockEntity('e3');
    expect(getDisplayName(entity)).toBe('e3');
  });

  it('uses provided fallback when id is also missing', () => {
    const entity = { getComponentData: () => undefined };
    expect(getDisplayName(entity, 'n/a')).toBe('n/a');
  });
});
