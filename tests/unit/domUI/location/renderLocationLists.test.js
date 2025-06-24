/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { renderLocationLists } from '../../../../src/domUI/location/renderLocationLists.js';

describe('renderLocationLists', () => {
  it('calls renderer._renderList with exits and characters', () => {
    const renderer = {
      _renderList: jest.fn(),
      elements: {
        exitsDisplay: document.createElement('div'),
        charactersDisplay: document.createElement('div'),
      },
    };

    const dto = {
      name: 'Loc',
      description: '',
      portraitPath: null,
      portraitAltText: null,
      exits: [{ description: 'North' }],
      characters: [{ name: 'Bob' }],
    };

    renderLocationLists(renderer, dto);

    expect(renderer._renderList).toHaveBeenCalledTimes(2);
    expect(renderer._renderList).toHaveBeenNthCalledWith(
      1,
      dto.exits,
      renderer.elements.exitsDisplay,
      'Exits',
      'description',
      '(None visible)'
    );
    expect(renderer._renderList).toHaveBeenNthCalledWith(
      2,
      dto.characters,
      renderer.elements.charactersDisplay,
      'Characters',
      'name',
      '(None else here)'
    );
  });
});
