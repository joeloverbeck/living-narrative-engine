/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DocumentContext from '../../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../../src/domUI/domElementFactory.js';
import {
  renderGenericSlotItem,
  renderSlotItem,
} from '../../../../src/domUI/helpers/renderSlotItem.js';

const createStubFactory = (overrides = {}) => {
  const baseFactory = {
    create: jest.fn((tagName, options = {}) => {
      const element = document.createElement(tagName);
      if (options.cls) {
        element.className = options.cls;
      }
      if (Object.prototype.hasOwnProperty.call(options, 'text')) {
        element.textContent = options.text;
      }
      return element;
    }),
    div: jest.fn((className) => {
      const element = document.createElement('div');
      if (className) {
        element.className = className;
      }
      return element;
    }),
    span: jest.fn((className, textContent = '') => {
      const element = document.createElement('span');
      if (className) {
        element.className = className;
      }
      element.textContent = textContent;
      return element;
    }),
  };

  return { ...baseFactory, ...overrides };
};

describe('renderSlotItem', () => {
  let factory;

  beforeEach(() => {
    document.body.innerHTML = '';
    const ctx = new DocumentContext(document);
    factory = new DomElementFactory(ctx);
  });

  it('creates slot element with info and playtime', () => {
    const handler = jest.fn();
    const slot = renderSlotItem(
      factory,
      'slotId',
      '1',
      {
        name: 'Save1',
        timestamp: 'Saved: now',
        playtime: 'Playtime: 00:10:00',
      },
      handler
    );
    expect(slot).toBeInstanceOf(HTMLElement);
    expect(slot.dataset.slotId).toBe('1');
    expect(slot.querySelector('.slot-name').textContent).toBe('Save1');
    expect(slot.querySelector('.slot-timestamp').textContent).toBe(
      'Saved: now'
    );
    expect(slot.querySelector('.slot-playtime').textContent).toBe(
      'Playtime: 00:10:00'
    );
    slot.click();
    expect(handler).toHaveBeenCalled();
  });

  it('returns null when factory is missing', () => {
    const res = renderSlotItem(null, 'id', '1', {}, undefined);
    expect(res).toBeNull();
  });

  it('returns null when createSelectableItem cannot create an element', () => {
    const stubFactory = createStubFactory({
      create: jest.fn(() => null),
    });

    const result = renderSlotItem(
      stubFactory,
      'slotId',
      'missing',
      { name: 'Broken slot' },
      undefined
    );

    expect(result).toBeNull();
    expect(stubFactory.create).toHaveBeenCalledWith(
      'div',
      expect.objectContaining({ cls: expect.stringContaining('save-slot') })
    );
  });

  it('skips slot info creation when domFactory.div returns null', () => {
    const stubFactory = createStubFactory({
      div: jest.fn(() => null),
    });

    const slot = renderSlotItem(
      stubFactory,
      'slotId',
      '2',
      { name: 'Save2', timestamp: 'Earlier' },
      undefined
    );

    expect(slot).toBeInstanceOf(HTMLElement);
    expect(stubFactory.span).not.toHaveBeenCalled();
    expect(slot?.querySelector('.slot-info')).toBeNull();
  });

  it('omits playtime element when metadata is missing the value', () => {
    const stubFactory = createStubFactory();

    const slot = renderSlotItem(
      stubFactory,
      'slotId',
      '3',
      undefined,
      undefined
    );

    expect(slot?.querySelector('.slot-playtime')).toBeNull();
    expect(slot?.dataset.slotId).toBe('3');
  });

  it('avoids appending playtime when span creation fails', () => {
    const spanMock = jest.fn((className, text) => {
      if (className === 'slot-playtime') {
        return null;
      }
      const element = document.createElement('span');
      element.className = className;
      element.textContent = text;
      return element;
    });

    const stubFactory = createStubFactory({ span: spanMock });

    const slot = renderSlotItem(
      stubFactory,
      'slotId',
      '4',
      {
        name: 'Save4',
        timestamp: 'Yesterday',
        playtime: '1h',
      },
      undefined
    );

    expect(spanMock).toHaveBeenCalledWith('slot-playtime', '1h');
    expect(slot?.querySelector('.slot-playtime')).toBeNull();
    expect(slot?.querySelector('.slot-info')).toBeInstanceOf(HTMLElement);
  });

  it('handles missing name and timestamp spans without appending children', () => {
    const spanMock = jest.fn((className, text) => {
      if (className === 'slot-name' || className === 'slot-timestamp') {
        return null;
      }
      const element = document.createElement('span');
      element.className = className;
      element.textContent = text;
      return element;
    });

    const stubFactory = createStubFactory({ span: spanMock });

    const slot = renderSlotItem(
      stubFactory,
      'slotId',
      '5',
      {
        name: 'Unused',
        timestamp: 'Ignored',
      },
      undefined
    );

    const infoDiv = slot?.querySelector('.slot-info');
    expect(infoDiv).toBeInstanceOf(HTMLElement);
    expect(infoDiv?.children).toHaveLength(0);
    expect(spanMock).toHaveBeenCalledWith('slot-name', 'Unused');
    expect(spanMock).toHaveBeenCalledWith('slot-timestamp', 'Ignored');
  });

  it('sets tabindex correctly via renderGenericSlotItem', () => {
    const slot = renderGenericSlotItem(
      factory,
      'slotId',
      '1',
      { name: 'Save1' },
      0,
      undefined
    );
    expect(slot?.getAttribute('tabindex')).toBe('0');
  });

  it('sets tabindex to -1 for non-initial items', () => {
    const stubFactory = createStubFactory();

    const slot = renderGenericSlotItem(
      stubFactory,
      'slotId',
      'second',
      { name: 'Save2' },
      2,
      undefined
    );

    expect(slot?.getAttribute('tabindex')).toBe('-1');
  });

  it('returns null from renderGenericSlotItem when base rendering fails', () => {
    const stubFactory = createStubFactory({
      create: jest.fn(() => null),
    });

    const result = renderGenericSlotItem(
      stubFactory,
      'slotId',
      'unrenderable',
      { name: 'Broken' },
      5,
      undefined
    );

    expect(result).toBeNull();
  });
});
