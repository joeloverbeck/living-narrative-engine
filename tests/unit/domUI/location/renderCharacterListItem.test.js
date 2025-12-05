/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest } from '@jest/globals';
import renderCharacterListItem, {
  renderCharacterListItem as namedRenderCharacterListItem,
} from '../../../../src/domUI/location/renderCharacterListItem.js';

const createDomFactory = () => ({
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
});

const documentContext = { document };

describe('renderCharacterListItem', () => {
  it('creates list item with portrait and tooltip', () => {
    const domFactory = createDomFactory();
    const ul = document.createElement('ul');
    const addListener = jest.fn((el, ev, cb) => el.addEventListener(ev, cb));
    const item = {
      name: 'Bob',
      portraitPath: '/p.png',
      description: 'A guy.\nWith a line break.',
    };
    renderCharacterListItem(item, ul, domFactory, documentContext, addListener);

    const li = ul.querySelector('li');
    expect(li).not.toBeNull();
    expect(li.querySelector('img').src).toContain('/p.png');
    expect(li.querySelector('.character-tooltip').innerHTML).toBe(
      'A guy.<br>With a line break.'
    );
    expect(addListener).toHaveBeenCalled();
  });

  it('handles missing portrait and description', () => {
    const domFactory = createDomFactory();
    const ul = document.createElement('ul');
    renderCharacterListItem({ name: 'Ann' }, ul, domFactory, documentContext);
    const li = ul.querySelector('li');
    expect(li).not.toBeNull();
    expect(li.querySelector('img')).toBeNull();
    expect(li.textContent).toContain('Ann');
  });

  it('adds default listener when handler is not provided', () => {
    const domFactory = createDomFactory();
    const ul = document.createElement('ul');
    const item = {
      name: 'Cara',
      description: 'Tooltip',
    };

    renderCharacterListItem(item, ul, domFactory, documentContext);

    const li = ul.querySelector('li');
    expect(li).not.toBeNull();
    expect(li.classList.contains('tooltip-open')).toBe(false);

    li.dispatchEvent(new Event('click'));
    expect(li.classList.contains('tooltip-open')).toBe(true);

    li.dispatchEvent(new Event('click'));
    expect(li.classList.contains('tooltip-open')).toBe(false);
  });

  it('renders Health line with newlines preserved in tooltip', () => {
    const domFactory = createDomFactory();
    const ul = document.createElement('ul');
    const item = {
      name: 'Dana',
      description: 'Wearing: Cloak.\nHealth: Perfect health.\nInventory: Coin.',
    };

    renderCharacterListItem(item, ul, domFactory, documentContext);

    const tooltip = ul.querySelector('.character-tooltip');
    expect(tooltip?.innerHTML).toBe(
      'Wearing: Cloak.<br>Health: Perfect health.<br>Inventory: Coin.'
    );
  });

  it('falls back to document-based elements when factory methods are missing', () => {
    const ul = document.createElement('ul');
    const item = {
      portraitPath: '/portrait.png',
    };

    renderCharacterListItem(item, ul, {}, documentContext);

    const li = ul.querySelector('li');
    expect(li).toBeInstanceOf(HTMLLIElement);
    expect(li.textContent).toContain('(Invalid name)');

    const img = li.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.src).toContain('/portrait.png');
    expect(img?.alt).toBe('Portrait of (Invalid name)');
    expect(img?.className).toBe('character-portrait');
  });

  it('export default matches the named export', () => {
    expect(renderCharacterListItem).toBe(namedRenderCharacterListItem);
  });
});
