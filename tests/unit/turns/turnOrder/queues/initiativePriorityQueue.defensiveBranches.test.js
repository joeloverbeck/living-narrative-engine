// src/tests/turns/order/queues/initiativePriorityQueue.defensiveBranches.test.js

/**
 * @file Unit tests covering defensive branches within InitiativePriorityQueue
 * that are typically unreachable during normal gameplay flows. These tests
 * ensure the queue gracefully handles unexpected TinyQueue behaviours.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import TinyQueue from 'tinyqueue';
import { InitiativePriorityQueue } from '../../../../../src/turns/order/queues/initiativePriorityQueue.js';

describe('InitiativePriorityQueue defensive behaviour', () => {
  /** @type {InitiativePriorityQueue} */
  let queue;

  beforeEach(() => {
    queue = new InitiativePriorityQueue();
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips undefined items returned by TinyQueue.pop in getNext()', () => {
    const entity = { id: 'entity-a' };
    queue.add(entity, 5);

    const popSpy = jest.spyOn(TinyQueue.prototype, 'pop');
    popSpy.mockImplementationOnce(function mockUndefinedPop() {
      this.length = Math.max(0, this.length - 1);
      return undefined;
    });

    expect(queue.getNext()).toBeNull();
    expect(queue.size()).toBe(1);
  });

  it('returns null when TinyQueue.peek unexpectedly yields undefined', () => {
    const entity = { id: 'entity-b' };
    queue.add(entity, 3);

    const peekSpy = jest.spyOn(TinyQueue.prototype, 'peek');
    peekSpy.mockImplementationOnce(() => undefined);

    expect(queue.peek()).toBeNull();

    peekSpy.mockRestore();
    const nextEntity = queue.getNext();
    expect(nextEntity).toEqual(entity);
  });

  it('returns an empty array when TinyQueue.pop yields undefined snapshot entries', () => {
    queue.add({ id: 'entity-c' }, 7);

    const popSpy = jest.spyOn(TinyQueue.prototype, 'pop');
    popSpy.mockImplementationOnce(function mockUndefinedSnapshotPop() {
      this.length = Math.max(0, this.length - 1);
      return undefined;
    });

    expect(queue.toArray()).toEqual([]);
    popSpy.mockRestore();
  });

  it('skips snapshot entries that are missing entity references', () => {
    const entity = { id: 'entity-d' };
    queue.add(entity, 9);

    const popSpy = jest.spyOn(TinyQueue.prototype, 'pop');
    popSpy
      .mockImplementationOnce(function mockMissingEntityPop() {
        return { removed: false, entity: undefined };
      })
      .mockImplementationOnce(function mockValidPop() {
        this.length = 0;
        return { removed: false, entity };
      });

    expect(queue.toArray()).toEqual([entity]);
    popSpy.mockRestore();
  });
});
