/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import DocumentContext from '../../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../../src/domUI/domElementFactory.js';
import { createSelectableItem } from '../../../../src/domUI/helpers/createSelectableItem.js';

describe('createSelectableItem', () => {
  let factory;

  beforeEach(() => {
    document.body.innerHTML = '';
    const ctx = new DocumentContext(document);
    factory = new DomElementFactory(ctx);
  });

  it('creates a div with expected attributes', () => {
    const el = createSelectableItem(factory, 'div', 'slotId', 1, 'Label');
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('save-slot')).toBe(true);
    expect(el.getAttribute('role')).toBe('radio');
    expect(el.dataset.slotId).toBe('1');
  });

  it('applies empty and corrupted classes and attaches handler', () => {
    const handler = jest.fn();
    const el = createSelectableItem(
      factory,
      'div',
      'slotId',
      '2',
      'Label',
      true,
      true,
      undefined,
      handler
    );
    expect(el.classList.contains('empty')).toBe(true);
    expect(el.classList.contains('corrupted')).toBe(true);
    el.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('creates li with text and extra classes', () => {
    const el = createSelectableItem(
      factory,
      'li',
      'llmId',
      'abc',
      'My LLM',
      false,
      false,
      'llm-item'
    );
    expect(el.tagName).toBe('LI');
    expect(el.textContent).toBe('My LLM');
    expect(el.classList.contains('llm-item')).toBe(true);
  });

  it('returns null when domFactory is missing', () => {
    const result = createSelectableItem(
      null,
      'div',
      'slotId',
      'missing',
      'Missing'
    );
    expect(result).toBeNull();
  });

  it('returns null when element creation fails', () => {
    const failingFactory = {
      create: jest.fn().mockReturnValue(null),
    };

    const result = createSelectableItem(
      failingFactory,
      'div',
      'slotId',
      'broken',
      'Broken'
    );

    expect(result).toBeNull();
    expect(failingFactory.create).toHaveBeenCalledWith(
      'div',
      expect.objectContaining({ cls: 'save-slot' })
    );
  });

  it('merges extra classes passed as an array', () => {
    const el = createSelectableItem(
      factory,
      'div',
      'slotId',
      4,
      'Array Class',
      false,
      false,
      ['first-class', 'second-class']
    );

    expect(el.className.split(' ')).toEqual(
      expect.arrayContaining(['first-class', 'second-class', 'save-slot'])
    );
  });

  it('does not attach click handler when onClick is not a function', () => {
    const element = document.createElement('div');
    const addEventListenerSpy = jest.spyOn(element, 'addEventListener');
    const factoryWithElement = {
      create: jest.fn().mockReturnValue(element),
    };

    const result = createSelectableItem(
      factoryWithElement,
      'div',
      'slotId',
      5,
      'No Handler',
      false,
      false,
      undefined,
      'not-a-function'
    );

    expect(result).toBe(element);
    expect(addEventListenerSpy).not.toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });
});
