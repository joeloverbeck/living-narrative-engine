/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderPortraitElements } from '../../../../src/domUI/location/renderPortraitElements.js';

const logger = {
  debug: jest.fn(),
  warn: jest.fn(),
};

describe('renderPortraitElements', () => {
  let img;
  let container;

  beforeEach(() => {
    img = document.createElement('img');
    container = document.createElement('div');
  });

  it('shows image when portraitPath is provided', () => {
    const dto = {
      name: 'Town',
      description: '',
      portraitPath: '/p.png',
      portraitAltText: 'alt',
      exits: [],
      characters: [],
    };
    renderPortraitElements(img, container, dto, logger);
    expect(img.src).toContain('/p.png');
    expect(img.alt).toBe('alt');
    expect(img.style.display).toBe('block');
    expect(container.style.display).toBe('flex');
  });

  it('hides image when no portraitPath', () => {
    const dto = {
      name: 'Field',
      description: '',
      portraitPath: null,
      portraitAltText: null,
      exits: [],
      characters: [],
    };
    renderPortraitElements(img, container, dto, logger);
    expect(container.style.display).toBe('none');
    expect(img.style.display).toBe('none');
    expect(img.getAttribute('src')).toBe('');
  });
});
