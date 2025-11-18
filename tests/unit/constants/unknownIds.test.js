import { describe, it, expect } from '@jest/globals';
import {
  UNKNOWN_ACTOR_ID,
  UNKNOWN_ENTITY_ID,
} from '../../../src/constants/unknownIds.js';
import * as unknownIdsModule from '../../../src/constants/unknownIds.js';

describe('unknownIds constants', () => {
  it('exposes stable sentinel identifiers for missing actors and entities', () => {
    expect(UNKNOWN_ACTOR_ID).toBe('UNKNOWN_ACTOR');
    expect(UNKNOWN_ENTITY_ID).toBe('UNKNOWN_ENTITY');

    expect(UNKNOWN_ACTOR_ID).toMatch(/^[A-Z_]+$/);
    expect(UNKNOWN_ENTITY_ID).toMatch(/^[A-Z_]+$/);
  });

  it('only exposes the documented exports on the module namespace object', () => {
    expect(Object.keys(unknownIdsModule).sort()).toEqual([
      'UNKNOWN_ACTOR_ID',
      'UNKNOWN_ENTITY_ID',
    ]);

    expect(Object.values(unknownIdsModule)).toEqual([
      'UNKNOWN_ACTOR',
      'UNKNOWN_ENTITY',
    ]);
  });

  it('supports dynamic import usage patterns for runtime tooling', async () => {
    const moduleNamespace = await import(
      '../../../src/constants/unknownIds.js'
    );

    expect(moduleNamespace).toEqual({
      UNKNOWN_ACTOR_ID: 'UNKNOWN_ACTOR',
      UNKNOWN_ENTITY_ID: 'UNKNOWN_ENTITY',
    });
  });

  it('treats the sentinel exports as immutable runtime constants', () => {
    expect(() => {
      // @ts-expect-error - intentionally verifying the binding is read-only.
      // eslint-disable-next-line no-import-assign
      UNKNOWN_ACTOR_ID = 'actor-override';
    }).toThrow(/read-only/i);

    expect(() => {
      // @ts-expect-error - intentionally verifying the binding is read-only.
      // eslint-disable-next-line no-import-assign
      UNKNOWN_ENTITY_ID = 'entity-override';
    }).toThrow(/read-only/i);
  });
});
