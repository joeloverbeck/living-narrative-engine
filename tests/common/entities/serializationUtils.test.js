import { describe, it, expect } from '@jest/globals';
import { buildSerializedEntity } from './index.js';

describe('buildSerializedEntity', () => {
  it('returns object with provided parameters', () => {
    const result = buildSerializedEntity('id1', 'def1', { c: 1 });
    expect(result).toEqual({
      instanceId: 'id1',
      definitionId: 'def1',
      components: { c: 1 },
    });
  });

  it('defaults components to empty object', () => {
    const result = buildSerializedEntity('id2', 'def2');
    expect(result).toEqual({
      instanceId: 'id2',
      definitionId: 'def2',
      components: {},
    });
  });
});
