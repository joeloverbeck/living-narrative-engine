/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import { renderCharacterListItem } from '../../../../src/domUI/location/renderCharacterListItem.js';

const domFactory = {
  li: jest.fn(() => document.createElement('li')),
  img: jest.fn((src, alt, cls) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.className = cls;
    return img;
  }),
  span: jest.fn((cls, text) => {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    return span;
  }),
};

const documentContext = { document };

describe('renderCharacterListItem', () => {
  it('creates list item with portrait and tooltip', () => {
    const ul = document.createElement('ul');
    const addListener = jest.fn((el, ev, cb) => el.addEventListener(ev, cb));
    const item = { name: 'Bob', portraitPath: '/p.png', description: 'A guy.' };
    renderCharacterListItem(item, ul, domFactory, documentContext, addListener);

    const li = ul.querySelector('li');
    expect(li).not.toBeNull();
    expect(li.querySelector('img').src).toContain('/p.png');
    expect(li.querySelector('.character-tooltip').textContent).toBe('A guy.');
    expect(addListener).toHaveBeenCalled();
  });

  it('handles missing portrait and description', () => {
    const ul = document.createElement('ul');
    renderCharacterListItem({ name: 'Ann' }, ul, domFactory, documentContext);
    const li = ul.querySelector('li');
    expect(li).not.toBeNull();
    expect(li.querySelector('img')).toBeNull();
    expect(li.textContent).toContain('Ann');
  });
});
