import { describe, expect, it } from '@jest/globals';
import * as actionTypesModule from '../../../src/actions/actionTypes.js';

const MODULE_PATH = '../../../src/actions/actionTypes.js';

describe('actionTypes module placeholder exports', () => {
  it('exposes only the ActionTypes placeholder object', () => {
    expect(Object.keys(actionTypesModule)).toEqual(['ActionTypes']);
    expect(actionTypesModule.ActionTypes).toEqual({});
    const descriptor = Object.getOwnPropertyDescriptor(
      actionTypesModule,
      'ActionTypes'
    );
    expect(descriptor).toMatchObject({ enumerable: true, configurable: true });
  });

  it('returns the same placeholder reference on subsequent imports', async () => {
    const first = actionTypesModule.ActionTypes;
    const { ActionTypes: dynamicImport } = await import(MODULE_PATH);
    expect(dynamicImport).toBe(first);
    expect(Object.getOwnPropertyNames(dynamicImport)).toEqual([]);
  });
});
