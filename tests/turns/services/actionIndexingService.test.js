import { ActionIndexingService } from '../../../src/turns/services/actionIndexingService.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../src/constants/core.js';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';

describe('ActionIndexingService', () => {
  let logger;
  let service;

  beforeEach(() => {
    logger = { warn: jest.fn(), info: jest.fn() };
    service = new ActionIndexingService(logger);
  });

  it('enumerates actions with correct indices (happy path)', () => {
    const rawActions = [
      {
        actionId: 'a',
        params: { x: 1 },
        commandString: 'cmd1',
        description: 'first',
      },
      {
        actionId: 'b',
        params: { y: 2 },
        commandString: 'cmd2',
        description: 'second',
      },
      {
        actionId: 'c',
        params: {},
        commandString: 'cmd3',
        description: 'third',
      },
    ];

    const indexed = service.indexActions('actor1', rawActions);

    expect(indexed).toHaveLength(3);
    indexed.forEach((comp, idx) => {
      expect(comp.index).toBe(idx + 1);
      expect(comp.actionId).toBe(rawActions[idx].actionId);
      expect(comp.commandString).toBe(rawActions[idx].commandString);
      expect(comp.params).toEqual(rawActions[idx].params);
      expect(comp.description).toBe(rawActions[idx].description);
    });
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('suppresses duplicate actions and logs info', () => {
    const rawActions = [
      {
        actionId: 'a',
        params: { x: 1 },
        commandString: 'cmd1',
        description: 'first',
      },
      {
        actionId: 'a',
        params: { x: 1 },
        commandString: 'cmd1',
        description: 'dup',
      },
      {
        actionId: 'b',
        params: {},
        commandString: 'cmd2',
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
        actionId: 'a',
        params: { x: 1 },
        commandString: 'cmd1',
        description: 'one',
      },
      {
        actionId: 'b',
        params: { x: 2 },
        commandString: 'cmd2',
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
      actionId: `act${i}`,
      params: {},
      commandString: `cmd${i}`,
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
        actionId: 'x',
        params: { foo: 'bar' },
        commandString: 'cmdX',
        description: 'descX',
      },
      {
        actionId: 'x',
        params: { foo: 'bar' },
        commandString: 'cmdX',
        description: 'dup',
      },
    ];

    const first = service.indexActions('actor42', raw);
    const second = service.indexActions('actor42', []);

    expect(second).toBe(first);
  });

  it('resets between turns and re-suppresses duplicates per actor', () => {
    service.indexActions('actorA', [
      { actionId: 'a', params: {}, commandString: 'c', description: 'd' },
      { actionId: 'a', params: {}, commandString: 'c', description: 'dup' },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      'ActionIndexingService: actor "actorA" suppressed 1 duplicate actions'
    );

    service.indexActions('actorB', [
      { actionId: 'a', params: {}, commandString: 'c', description: 'd' },
      { actionId: 'a', params: {}, commandString: 'c', description: 'dup' },
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
      { actionId: 'a', params: {}, commandString: 'c', description: 'd' },
      { actionId: 'b', params: {}, commandString: 'c2', description: 'd2' },
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
      { actionId: 'x', params: {}, commandString: 'cmd', description: 'desc' },
    ]);
    expect(() => service.resolve('actorZ', 2)).toThrow(
      'No action found at index 2 for actor "actorZ"'
    );
  });
});
