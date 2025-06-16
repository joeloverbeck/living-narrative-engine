/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import createMessageElement from '../../../src/domUI/helpers/createMessageElement.js';

describe('createMessageElement', () => {
  let factory;

  beforeEach(() => {
    document.body.innerHTML = '';
    const ctx = new DocumentContext(document);
    factory = new DomElementFactory(ctx);
  });

  it('creates paragraph with class and text', () => {
    const el = createMessageElement(factory, 'test-class', 'hello');
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName).toBe('P');
    expect(el.classList.contains('test-class')).toBe(true);
    expect(el.textContent).toBe('hello');
  });

  it.each([
    ['factory is null', null],
    ['p method returns null', { p: () => null }],
  ])('falls back to text node when %s', (_desc, badFactory) => {
    const node = createMessageElement(badFactory, 'x', 'msg');
    expect(node.nodeType).toBe(Node.TEXT_NODE);
    expect(node.textContent).toBe('msg');
  });
});
