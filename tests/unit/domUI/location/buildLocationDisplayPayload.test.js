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

  it('uses location-based default alt text when portrait alt text is missing', () => {
    const details = {
      name: 'Cliffside',
      description: 'A high vantage point',
      exits: [{ description: 'Path down' }],
    };
    const portrait = { imagePath: '/img/cliff.png' };
    const characters = [{ id: 'npc:2', name: 'Scout' }];

    const result = buildLocationDisplayPayload(details, portrait, characters);

    expect(result).toEqual({
      name: 'Cliffside',
      description: 'A high vantage point',
      portraitPath: '/img/cliff.png',
      portraitAltText: 'Image of Cliffside',
      exits: [{ description: 'Path down' }],
      characters,
    });
    expect(portrait).not.toHaveProperty('altText');
  });
});
