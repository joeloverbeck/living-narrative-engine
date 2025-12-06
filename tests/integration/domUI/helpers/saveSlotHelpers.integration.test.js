import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DocumentContext from '../../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../../src/domUI/domElementFactory.js';
import { createSelectableItem } from '../../../../src/domUI/helpers/createSelectableItem.js';
import {
  renderSlotItem,
  renderGenericSlotItem,
} from '../../../../src/domUI/helpers/renderSlotItem.js';
import createEmptySlotMessage from '../../../../src/domUI/helpers/createEmptySlotMessage.js';

describe('domUI save slot helpers integration', () => {
  /** @type {DomElementFactory} */
  let domFactory;

  beforeEach(() => {
    document.body.innerHTML = '<ul id="slots"></ul>';
    const docContext = new DocumentContext(document);
    domFactory = new DomElementFactory(docContext);
  });

  it('creates selectable slot elements with dataset, classes, and click behaviour', () => {
    const clickSpy = jest.fn();

    const liSlot = createSelectableItem(
      domFactory,
      'li',
      'slotId',
      5,
      'Slot 5',
      true,
      true,
      ['custom-class', 'utility'],
      clickSpy
    );

    expect(liSlot).toBeInstanceOf(HTMLElement);
    expect(liSlot?.classList.contains('save-slot')).toBe(true);
    expect(liSlot?.classList.contains('empty')).toBe(true);
    expect(liSlot?.classList.contains('corrupted')).toBe(true);
    expect(liSlot?.classList.contains('custom-class')).toBe(true);
    expect(liSlot?.dataset.slotId).toBe('5');
    expect(liSlot?.textContent).toBe('Slot 5');

    liSlot?.dispatchEvent(new Event('click'));
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const divSlot = createSelectableItem(
      domFactory,
      'div',
      'slotId',
      'alpha',
      'Alpha Slot',
      false,
      false,
      'extra'
    );

    expect(divSlot).toBeInstanceOf(HTMLElement);
    expect(divSlot?.textContent).toBe('Alpha Slot');
    expect(divSlot?.classList.contains('extra')).toBe(true);

    const defaultedSlot = createSelectableItem(
      domFactory,
      'div',
      'slotId',
      'delta',
      'Delta Slot'
    );

    expect(defaultedSlot).toBeInstanceOf(HTMLElement);
    expect(defaultedSlot?.classList.contains('empty')).toBe(false);
    expect(defaultedSlot?.classList.contains('corrupted')).toBe(false);

    expect(
      createSelectableItem(null, 'div', 'slotId', 'missing', 'Missing')
    ).toBeNull();

    const failingFactory = { create: () => null };
    expect(
      createSelectableItem(
        failingFactory,
        'div',
        'slotId',
        'broken',
        'Broken Slot'
      )
    ).toBeNull();
  });

  it('renders slot items with metadata, optional playtime, and tabindex management', () => {
    const clickSpy = jest.fn();
    const metadata = {
      name: 'Hero Progress',
      timestamp: '2025-04-03 12:00',
      playtime: '03:42',
      isEmpty: false,
      isCorrupted: false,
    };

    const slot = renderSlotItem(
      domFactory,
      'saveId',
      'slot-alpha',
      metadata,
      clickSpy
    );

    expect(slot).toBeInstanceOf(HTMLElement);
    expect(slot?.dataset.saveId).toBe('slot-alpha');

    const infoSection = slot?.querySelector('.slot-info');
    expect(infoSection).not.toBeNull();
    const [nameSpan, timestampSpan] =
      infoSection?.querySelectorAll('span') ?? [];
    expect(nameSpan?.textContent).toBe('Hero Progress');
    expect(timestampSpan?.textContent).toBe('2025-04-03 12:00');

    const playtimeSpan = slot?.querySelector('.slot-playtime');
    expect(playtimeSpan?.textContent).toBe('03:42');

    slot?.dispatchEvent(new Event('click'));
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const withTabindex = renderGenericSlotItem(
      domFactory,
      'saveId',
      'slot-beta',
      { name: 'Secondary', timestamp: 'Later' },
      0
    );

    const laterItem = renderGenericSlotItem(
      domFactory,
      'saveId',
      'slot-gamma',
      { name: 'Tertiary', timestamp: 'Much later' },
      3
    );

    expect(withTabindex?.getAttribute('tabindex')).toBe('0');
    expect(laterItem?.getAttribute('tabindex')).toBe('-1');

    const defaultsSlot = renderSlotItem(
      domFactory,
      'saveId',
      'slot-default',
      null
    );
    expect(defaultsSlot).toBeInstanceOf(HTMLElement);
    expect(defaultsSlot?.querySelector('.slot-playtime')).toBeNull();

    expect(renderSlotItem(null, 'saveId', 'slot-missing', metadata)).toBeNull();

    const nullFactory = {
      create: () => document.createElement('div'),
      div: () => null,
      span: () => null,
    };
    const branchSlot = renderSlotItem(nullFactory, 'saveId', 'slot-branch', {
      name: 'Ignored',
      timestamp: 'Ignored',
      playtime: 'Skip',
    });
    expect(branchSlot).toBeInstanceOf(HTMLElement);
    expect(branchSlot?.querySelector('.slot-info')).toBeNull();
    expect(branchSlot?.querySelector('.slot-playtime')).toBeNull();

    const nullElementFactory = {
      create: () => document.createElement('div'),
      div: (cls) => {
        const element = document.createElement('div');
        if (cls) {
          element.className = cls;
        }
        return element;
      },
      span: (cls, text) => {
        if (cls === 'slot-playtime') {
          return null;
        }
        const element = document.createElement('span');
        element.className = cls ?? '';
        if (text !== undefined) {
          element.textContent = text;
        }
        return element;
      },
    };
    const partialSlot = renderSlotItem(
      nullElementFactory,
      'saveId',
      'slot-partial',
      { name: 'Partial', timestamp: 'Partial', playtime: 'Hidden' }
    );
    expect(partialSlot?.querySelector('.slot-info')?.childElementCount).toBe(2);
    expect(partialSlot?.querySelector('.slot-playtime')).toBeNull();

    const timestampNullFactory = {
      create: () => document.createElement('div'),
      div: (cls) => {
        const element = document.createElement('div');
        if (cls) {
          element.className = cls;
        }
        return element;
      },
      span: (cls, text) => {
        if (cls === 'slot-timestamp') {
          return null;
        }
        const element = document.createElement('span');
        element.className = cls ?? '';
        if (text !== undefined) {
          element.textContent = text;
        }
        return element;
      },
    };
    const nameOnlySlot = renderSlotItem(
      timestampNullFactory,
      'saveId',
      'slot-name-only',
      { name: 'Solo', timestamp: 'Hidden' }
    );
    expect(nameOnlySlot?.querySelector('.slot-name')).not.toBeNull();
    expect(nameOnlySlot?.querySelector('.slot-timestamp')).toBeNull();

    const nameNullFactory = {
      create: () => document.createElement('div'),
      div: (cls) => {
        const element = document.createElement('div');
        if (cls) {
          element.className = cls;
        }
        return element;
      },
      span: (cls, text) => {
        if (cls === 'slot-name') {
          return null;
        }
        const element = document.createElement('span');
        element.className = cls ?? '';
        if (text !== undefined) {
          element.textContent = text;
        }
        return element;
      },
    };
    const timestampOnlySlot = renderSlotItem(
      nameNullFactory,
      'saveId',
      'slot-timestamp-only',
      { name: 'Hidden', timestamp: 'Visible' }
    );
    expect(timestampOnlySlot?.querySelector('.slot-name')).toBeNull();
    expect(timestampOnlySlot?.querySelector('.slot-timestamp')).not.toBeNull();

    const failingCreateFactory = {
      create: () => null,
      div: () => null,
      span: () => null,
    };
    expect(
      renderSlotItem(failingCreateFactory, 'saveId', 'slot-null', {
        name: 'Ignored',
      })
    ).toBeNull();

    const fallbackGeneric = renderGenericSlotItem(
      failingCreateFactory,
      'saveId',
      'slot-null',
      { name: 'Ignored' },
      1
    );
    expect(fallbackGeneric).toBeNull();
  });

  it('creates empty slot messages using available factory fallbacks', () => {
    const liMessage = createEmptySlotMessage(domFactory, 'No saves available');
    expect(liMessage).toBeInstanceOf(HTMLElement);
    expect(liMessage?.tagName).toBe('LI');
    expect(liMessage?.textContent).toBe('No saves available');

    const fallbackFactory = {
      li: () => null,
      p: (cls, text) => {
        const paragraph = document.createElement('p');
        paragraph.className = cls;
        paragraph.textContent = text;
        return paragraph;
      },
    };

    const pMessage = createEmptySlotMessage(fallbackFactory, 'Nothing to show');
    expect(pMessage).toBeInstanceOf(HTMLElement);
    expect(pMessage?.tagName).toBe('P');
    expect(pMessage?.textContent).toBe('Nothing to show');

    const rawMessage = createEmptySlotMessage({}, 'Fallback string');
    expect(rawMessage).toBe('Fallback string');
  });
});
