import { describe, it, expect } from '@jest/globals';
import { buildLocationDisplayPayload } from '../../../../src/domUI/location/buildLocationDisplayPayload.js';

describe('buildLocationDisplayPayload', () => {
  it('creates payload with portrait data', () => {
    const details = { name: 'Town', description: 'A nice place', exits: [] };
    const portrait = { imagePath: '/img/town.png', altText: 'Town view' };
    const chars = [{ id: 'npc:1', name: 'Bob' }];
    const result = buildLocationDisplayPayload(details, portrait, chars);
    expect(result).toEqual({
      name: 'Town',
      description: 'A nice place',
      portraitPath: '/img/town.png',
      portraitAltText: 'Town view',
      exits: [],
      characters: chars,
    });
  });

  it('handles null portrait data', () => {
    const details = { name: 'Field', description: 'Open area', exits: [] };
    const result = buildLocationDisplayPayload(details, null, []);
    expect(result).toEqual({
      name: 'Field',
      description: 'Open area',
      portraitPath: null,
      portraitAltText: null,
      exits: [],
      characters: [],
    });
  });
});
