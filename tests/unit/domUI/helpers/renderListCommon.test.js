/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderListCommon } from '../../../../src/domUI/helpers/renderListCommon.js';
import DocumentContext from '../../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../../src/domUI/domElementFactory.js';

const logger = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('renderListCommon', () => {
  let container;
  let factory;

  beforeEach(() => {
    document.body.innerHTML = '';
    const ctx = new DocumentContext(document);
    factory = new DomElementFactory(ctx);
    container = document.createElement('div');
  });

  it('renders items returned by fetchData', async () => {
    const data = ['a', 'b'];
    const fetchData = jest.fn().mockResolvedValue(data);
    const renderItem = jest.fn((item) => factory.div('item', item));
    const emptyMsg = jest.fn(() => 'empty');

    const result = await renderListCommon(
      fetchData,
      renderItem,
      emptyMsg,
      container,
      logger,
      factory
    );

    expect(result).toEqual(data);
    expect(container.querySelectorAll('.item').length).toBe(2);
  });

  it('shows empty message when list is empty', async () => {
    const fetchData = jest.fn().mockResolvedValue([]);
    const renderItem = jest.fn();
    const emptyMsg = jest.fn(() => 'none');

    const result = await renderListCommon(
      fetchData,
      renderItem,
      emptyMsg,
      container,
      logger,
      factory
    );

    expect(result).toEqual([]);
    expect(container.textContent).toBe('none');
  });

  it('returns null and displays error when fetch fails', async () => {
    const fetchData = jest.fn().mockRejectedValue(new Error('fail'));
    const renderItem = jest.fn();
    const emptyMsg = jest.fn(() => 'none');

    const result = await renderListCommon(
      fetchData,
      renderItem,
      emptyMsg,
      container,
      logger,
      factory
    );

    expect(result).toBeNull();
    expect(container.textContent).toBe('Error loading list data.');
  });
});
