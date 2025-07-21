/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderPortraitElements } from '../../../../src/domUI/location/renderPortraitElements.js';

const logger = {
  debug: jest.fn(),
  warn: jest.fn(),
};

const domFactory = {
  // Mock implementation not needed for these tests
};

const documentContext = {
  document: document,
};

describe('renderPortraitElements', () => {
  let img;
  let container;
  let addListenerMock;

  beforeEach(() => {
    img = document.createElement('img');
    container = document.createElement('div');
    addListenerMock = jest.fn();
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
    renderPortraitElements(
      img,
      container,
      dto,
      logger,
      domFactory,
      documentContext,
      addListenerMock
    );
    expect(img.src).toContain('/p.png');
    expect(img.alt).toBe('alt');
    expect(img.style.display).toBe('block');
    expect(container.style.display).toBe('block');
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
    renderPortraitElements(
      img,
      container,
      dto,
      logger,
      domFactory,
      documentContext,
      addListenerMock
    );
    expect(container.style.display).toBe('none');
    expect(img.style.display).toBe('none');
    expect(img.getAttribute('src')).toBe('');
  });

  it('adds tooltip when portrait and description exist', () => {
    const dto = {
      name: 'Town Square',
      description: 'A bustling marketplace.',
      portraitPath: '/town.png',
      portraitAltText: 'Town square',
      exits: [],
      characters: [],
    };
    renderPortraitElements(
      img,
      container,
      dto,
      logger,
      domFactory,
      documentContext,
      addListenerMock
    );

    const tooltip = container.querySelector('.location-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip.innerHTML).toBe('A bustling marketplace.');
    expect(addListenerMock).toHaveBeenCalledWith(
      container,
      'click',
      expect.any(Function)
    );
    expect(container.getAttribute('tabindex')).toBe('0');
    expect(container.getAttribute('role')).toBe('button');
  });

  it('does not add tooltip when no description', () => {
    const dto = {
      name: 'Town',
      description: '',
      portraitPath: '/p.png',
      portraitAltText: 'alt',
      exits: [],
      characters: [],
    };
    renderPortraitElements(
      img,
      container,
      dto,
      logger,
      domFactory,
      documentContext,
      addListenerMock
    );

    const tooltip = container.querySelector('.location-tooltip');
    expect(tooltip).toBeFalsy();
    expect(addListenerMock).not.toHaveBeenCalled();
  });

  it('removes existing tooltip when re-rendering', () => {
    // First render with description
    const dto1 = {
      name: 'Town',
      description: 'Old description',
      portraitPath: '/p.png',
      portraitAltText: 'alt',
      exits: [],
      characters: [],
    };
    renderPortraitElements(
      img,
      container,
      dto1,
      logger,
      domFactory,
      documentContext,
      addListenerMock
    );

    // Second render with new description
    const dto2 = {
      name: 'Town',
      description: 'New description',
      portraitPath: '/p.png',
      portraitAltText: 'alt',
      exits: [],
      characters: [],
    };
    renderPortraitElements(
      img,
      container,
      dto2,
      logger,
      domFactory,
      documentContext,
      addListenerMock
    );

    const tooltips = container.querySelectorAll('.location-tooltip');
    expect(tooltips.length).toBe(1);
    expect(tooltips[0].innerHTML).toBe('New description');
  });
});
