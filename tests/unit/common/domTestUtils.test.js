import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createTestElement,
  createTestContainer,
  cleanupTestElements,
} from '../../common/domTestUtils.js';

describe('domTestUtils', () => {
  const createdIds = [];

  beforeEach(() => {
    createdIds.length = 0;
  });

  afterEach(() => {
    cleanupTestElements(createdIds);
  });

  it('creates elements with ids, attributes, and class names', () => {
    const element = createTestElement({
      id: 'test-element',
      tag: 'button',
      className: 'primary secondary',
      attributes: { 'data-testid': 'test', role: 'button' },
      textContent: 'Click me',
    });

    createdIds.push(element.id);

    expect(element.id).toBe('test-element');
    expect(element.tagName.toLowerCase()).toBe('button');
    expect(element.className).toBe('primary secondary');
    expect(element.getAttribute('data-testid')).toBe('test');
    expect(element.getAttribute('role')).toBe('button');
    expect(element.textContent).toBe('Click me');
    expect(document.body.contains(element)).toBe(true);
  });

  it('builds containers with configured child elements', () => {
    const { container, children } = createTestContainer({
      containerId: 'root-container',
      className: 'wrapper',
      children: [
        { id: 'child-one', tag: 'div', className: 'first' },
        { id: 'child-two', tag: 'span', attributes: { 'data-role': 'second' } },
      ],
    });

    createdIds.push(container.id, ...Object.keys(children));

    expect(container.id).toBe('root-container');
    expect(container.className).toBe('wrapper');
    expect(children['child-one'].classList.contains('first')).toBe(true);
    expect(children['child-two'].getAttribute('data-role')).toBe('second');
    expect(container.contains(children['child-one'])).toBe(true);
    expect(container.contains(children['child-two'])).toBe(true);
  });

  it('removes elements by id or reference', () => {
    const element = createTestElement({ id: 'to-remove', tag: 'div' });
    const { container } = createTestContainer({
      containerId: 'remove-container',
      children: [{ id: 'nested-child', tag: 'p' }],
    });

    createdIds.push(element.id, container.id, 'nested-child');

    expect(document.getElementById('to-remove')).toBeTruthy();
    expect(document.getElementById('remove-container')).toBeTruthy();

    cleanupTestElements(['to-remove', container]);

    expect(document.getElementById('to-remove')).toBeNull();
    expect(document.getElementById('remove-container')).toBeNull();
  });
});
