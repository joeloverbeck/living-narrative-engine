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
    jest.clearAllMocks();
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
    const message = container.querySelector('.empty-list-message');
    expect(message).toBeTruthy();
    expect(message?.textContent).toBe('none');
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
    const message = container.querySelector('.error-message');
    expect(message).toBeTruthy();
    expect(message?.textContent).toBe('Error loading list data.');
  });

  it('falls back to simple text error when fetch fails without factory', async () => {
    const fetchData = jest.fn().mockRejectedValue(new Error('fail'));

    const result = await renderListCommon(
      fetchData,
      jest.fn(),
      () => 'unused',
      container,
      logger
    );

    expect(result).toBeNull();
    expect(container.textContent).toBe('Error loading list data.');
  });

  it('uses plain text when empty message is string and no factory provided', async () => {
    const fetchData = jest.fn().mockResolvedValue([]);
    const emptyMsg = jest.fn(() => 'no data');

    const result = await renderListCommon(
      fetchData,
      jest.fn(),
      emptyMsg,
      container,
      logger
    );

    expect(result).toEqual([]);
    expect(container.textContent).toBe('no data');
  });

  it('appends HTMLElement returned by getEmptyMessage', async () => {
    const fetchData = jest.fn().mockResolvedValue([]);
    const messageEl = document.createElement('p');
    messageEl.textContent = 'Empty';

    const result = await renderListCommon(
      fetchData,
      jest.fn(),
      () => messageEl,
      container,
      logger,
      factory
    );

    expect(result).toEqual([]);
    expect(container.firstChild).toBe(messageEl);
  });

  it('falls back to default empty message and warns for invalid empty message type', async () => {
    const fetchData = jest.fn().mockResolvedValue(null);
    const result = await renderListCommon(
      fetchData,
      jest.fn(),
      () => 123,
      container,
      logger,
      factory
    );

    expect(result).toBeNull();
    const message = container.querySelector('.empty-list-message');
    expect(message).toBeTruthy();
    expect(message?.textContent).toBe('List is empty.');
    expect(logger.warn).toHaveBeenCalledWith(
      '[renderListCommon] getEmptyMessage returned invalid type.',
      expect.objectContaining({ type: 'number' })
    );
  });

  it('falls back to default empty message string when factory missing', async () => {
    const fetchData = jest.fn().mockResolvedValue({});

    const result = await renderListCommon(
      fetchData,
      jest.fn(),
      () => Symbol('bad'),
      container,
      logger
    );

    expect(result).toBeNull();
    expect(container.textContent).toBe('List is empty.');
    expect(logger.warn).toHaveBeenCalledWith(
      '[renderListCommon] getEmptyMessage returned invalid type.',
      expect.objectContaining({ type: 'symbol' })
    );
  });

  it('warns when renderItem returns non-null non-element value', async () => {
    const fetchData = jest.fn().mockResolvedValue(['item']);
    const renderItem = jest.fn(() => 'not-element');

    const result = await renderListCommon(
      fetchData,
      renderItem,
      () => 'empty',
      container,
      logger,
      factory
    );

    expect(result).toEqual(['item']);
    expect(container.childNodes).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      '[renderListCommon] renderItem did not return an element.',
      expect.objectContaining({
        item: 'item',
        returnedValue: 'not-element',
      })
    );
  });

  it('ignores null renderItem results without logging', async () => {
    const fetchData = jest.fn().mockResolvedValue(['value']);
    const renderItem = jest.fn(() => null);

    const result = await renderListCommon(
      fetchData,
      renderItem,
      () => 'empty',
      container,
      logger,
      factory
    );

    expect(result).toEqual(['value']);
    expect(container.childNodes).toHaveLength(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('handles renderItem throwing and continues processing', async () => {
    const problematic = new Error('boom');
    const fetchData = jest.fn().mockResolvedValue(['a', 'b']);
    const renderItem = jest
      .fn()
      .mockImplementationOnce(() => {
        throw problematic;
      })
      .mockImplementationOnce((item) => factory.div('item', item));

    const result = await renderListCommon(
      fetchData,
      renderItem,
      () => 'empty',
      container,
      logger,
      factory
    );

    expect(result).toEqual(['a', 'b']);
    expect(container.querySelectorAll('.item')).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith(
      '[renderListCommon] Error in renderItem:',
      problematic,
      expect.objectContaining({ item: 'a' })
    );
  });
});
