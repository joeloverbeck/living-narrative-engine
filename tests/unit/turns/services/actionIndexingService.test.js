import { ActionIndexingService } from '../../../../src/turns/services/actionIndexingService.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../../src/constants/core.js';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

describe('ActionIndexingService', () => {
  let logger;
  let service;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    service = new ActionIndexingService({ logger });
  });

  it('enumerates actions with correct indices (happy path)', () => {
    const rawActions = [
      {
        id: 'a',
        params: { x: 1 },
        command: 'cmd1',
        description: 'first',
      },
      {
        id: 'b',
        params: { y: 2 },
        command: 'cmd2',
        description: 'second',
      },
      {
        id: 'c',
        params: {},
        command: 'cmd3',
        description: 'third',
      },
    ];

    const indexed = service.indexActions('actor1', rawActions);

    expect(indexed).toHaveLength(3);
    indexed.forEach((comp, idx) => {
      expect(comp.index).toBe(idx + 1);
      expect(comp.actionId).toBe(rawActions[idx].id);
      expect(comp.commandString).toBe(rawActions[idx].command);
      expect(comp.params).toEqual(rawActions[idx].params);
      expect(comp.description).toBe(rawActions[idx].description);
    });
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('suppresses duplicate actions and logs info', () => {
    const rawActions = [
      {
        id: 'a',
        params: { x: 1 },
        command: 'cmd1',
        description: 'first',
      },
      {
        id: 'a',
        params: { x: 1 },
        command: 'cmd1',
        description: 'dup',
      },
      {
        id: 'b',
        params: {},
        command: 'cmd2',
        description: 'second',
      },
    ];

    const result = service.indexActions('actor1', rawActions);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.actionId)).toEqual(['a', 'b']);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'ActionIndexingService: actor "actor1" suppressed 1 duplicate actions'
    );
  });

  it('does not log info when there are no duplicates', () => {
    const rawActions = [
      {
        id: 'a',
        params: { x: 1 },
        command: 'cmd1',
        description: 'one',
      },
      {
        id: 'b',
        params: { x: 2 },
        command: 'cmd2',
        description: 'two',
      },
    ];

    const result = service.indexActions('actor1', rawActions);

    expect(result).toHaveLength(2);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('caps actions and logs warn when exceeding MAX_AVAILABLE_ACTIONS_PER_TURN', () => {
    const excess = 3;
    const total = MAX_AVAILABLE_ACTIONS_PER_TURN + excess;
    const rawActions = Array.from({ length: total }, (_, i) => ({
      id: `act${i}`,
      params: {},
      command: `cmd${i}`,
      description: `desc${i}`,
    }));

    const result = service.indexActions('actorOverflow', rawActions);

    expect(result).toHaveLength(MAX_AVAILABLE_ACTIONS_PER_TURN);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      `ActionIndexingService: actor "actorOverflow" truncated ${excess} actions, processing only the first ${MAX_AVAILABLE_ACTIONS_PER_TURN}`
    );
  });

  it('is idempotent within the same turn', () => {
    const raw = [
      {
        id: 'x',
        params: { foo: 'bar' },
        command: 'cmdX',
        description: 'descX',
      },
      {
        id: 'x',
        params: { foo: 'bar' },
        command: 'cmdX',
        description: 'dup',
      },
    ];

    const first = service.indexActions('actor42', raw);
    const second = service.indexActions('actor42', []);

    expect(second).toBe(first);
  });

  it('resets between turns and re-suppresses duplicates per actor', () => {
    service.indexActions('actorA', [
      { id: 'a', params: {}, command: 'c', description: 'd' },
      { id: 'a', params: {}, command: 'c', description: 'dup' },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      'ActionIndexingService: actor "actorA" suppressed 1 duplicate actions'
    );

    service.indexActions('actorB', [
      { id: 'a', params: {}, command: 'c', description: 'd' },
      { id: 'a', params: {}, command: 'c', description: 'dup' },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      'ActionIndexingService: actor "actorB" suppressed 1 duplicate actions'
    );
  });

  it('throws if getIndexedList called before indexActions', () => {
    expect(() => service.getIndexedList('actorX')).toThrow(
      'No indexed action list for actor "actorX"'
    );
  });

  it('getIndexedList returns a copy and protects internal state', () => {
    const raw = [
      { id: 'a', params: {}, command: 'c', description: 'd' },
      { id: 'b', params: {}, command: 'c2', description: 'd2' },
    ];
    service.indexActions('actorY', raw);
    const firstList = service.getIndexedList('actorY');
    firstList.pop();
    const secondList = service.getIndexedList('actorY');
    expect(secondList).toHaveLength(2);
  });

  it('resolve throws if called before indexActions', () => {
    expect(() => service.resolve('actorZ', 1)).toThrow(
      'No actions indexed for actor "actorZ"'
    );
  });

  it('resolve throws if index out of range', () => {
    service.indexActions('actorZ', [
      { id: 'x', params: {}, command: 'cmd', description: 'desc' },
    ]);
    expect(() => service.resolve('actorZ', 2)).toThrow(
      'No action found at index 2 for actor "actorZ"'
    );
  });
});
