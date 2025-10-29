import { ActionIndexingService } from '../../../../src/turns/services/actionIndexingService.js';
import { ActionIndexingError } from '../../../../src/turns/services/errors/actionIndexingError.js';
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

  describe('constructor', () => {
    it('throws error when logger is missing', () => {
      expect(() => new ActionIndexingService({})).toThrow(
        'ActionIndexingService: logger required'
      );
    });

    it('throws error when logger is null', () => {
      expect(() => new ActionIndexingService({ logger: null })).toThrow(
        'ActionIndexingService: logger required'
      );
    });

    it('throws error when logger.debug is not a function', () => {
      const invalidLogger = {
        debug: 'not a function',
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      expect(
        () => new ActionIndexingService({ logger: invalidLogger })
      ).toThrow('ActionIndexingService: logger required');
    });

    it('creates instance successfully with valid logger missing some methods', () => {
      const minimalLogger = {
        debug: jest.fn(),
      };
      expect(
        () => new ActionIndexingService({ logger: minimalLogger })
      ).not.toThrow();
    });
  });

  describe('indexActions', () => {
    it('throws TypeError when actorId is not a string', () => {
      expect(() => service.indexActions(123, [])).toThrow(TypeError);
      expect(() => service.indexActions(123, [])).toThrow(
        'ActionIndexingService.indexActions: actorId must be a non-empty string'
      );

      expect(() => service.indexActions(null, [])).toThrow(TypeError);
      expect(() => service.indexActions(undefined, [])).toThrow(TypeError);
      expect(() => service.indexActions({}, [])).toThrow(TypeError);
      expect(() => service.indexActions([], [])).toThrow(TypeError);
    });

    it('throws TypeError when actorId is empty or whitespace', () => {
      expect(() => service.indexActions('', [])).toThrow(TypeError);
      expect(() => service.indexActions('', [])).toThrow(
        'ActionIndexingService.indexActions: actorId must be a non-empty string'
      );

      expect(() => service.indexActions('   ', [])).toThrow(TypeError);
      expect(() => service.indexActions('\t', [])).toThrow(TypeError);
      expect(() => service.indexActions('\n', [])).toThrow(TypeError);
    });

    it('throws TypeError when discovered is not an array', () => {
      expect(() => service.indexActions('actor1', null)).toThrow(TypeError);
      expect(() => service.indexActions('actor1', null)).toThrow(
        'ActionIndexingService.indexActions: discovered must be an array'
      );

      expect(() => service.indexActions('actor1', undefined)).toThrow(
        TypeError
      );
      expect(() => service.indexActions('actor1', 'not an array')).toThrow(
        TypeError
      );
      expect(() => service.indexActions('actor1', 123)).toThrow(TypeError);
      expect(() => service.indexActions('actor1', {})).toThrow(TypeError);
    });
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

  it('preserves Date parameters when cloning action payloads', () => {
    const timestamp = new Date('2024-05-01T12:34:56.000Z');
    const rawActions = [
      {
        id: 'with-date',
        params: { scheduledAt: timestamp },
        command: 'cmd-with-date',
        description: 'action containing a date',
      },
    ];

    const [composite] = service.indexActions('actor-date', rawActions);

    expect(composite.params.scheduledAt).toBeInstanceOf(Date);
    expect(composite.params.scheduledAt.getTime()).toBe(
      timestamp.getTime()
    );
    expect(Object.isFrozen(composite.params.scheduledAt)).toBe(true);
    expect(composite.params.scheduledAt).not.toBe(timestamp);
  });

  it('preserves visual properties from discovered actions', () => {
    const rawActions = [
      {
        id: 'action1',
        params: { x: 1 },
        command: 'cmd1',
        description: 'first action',
        visual: {
          backgroundColor: '#ff0000',
          textColor: '#ffffff',
          hoverBackgroundColor: '#cc0000',
          hoverTextColor: '#ffcccc',
        },
      },
      {
        id: 'action2',
        params: { y: 2 },
        command: 'cmd2',
        description: 'second action',
        visual: {
          backgroundColor: '#00ff00',
          textColor: '#000000',
        },
      },
      {
        id: 'action3',
        params: {},
        command: 'cmd3',
        description: 'third action without visual',
      },
    ];

    const indexed = service.indexActions('actor1', rawActions);

    expect(indexed).toHaveLength(3);

    // First action should have complete visual properties
    expect(indexed[0].visual).toEqual({
      backgroundColor: '#ff0000',
      textColor: '#ffffff',
      hoverBackgroundColor: '#cc0000',
      hoverTextColor: '#ffcccc',
    });

    // Second action should have partial visual properties
    expect(indexed[1].visual).toEqual({
      backgroundColor: '#00ff00',
      textColor: '#000000',
    });

    // Third action should have null visual
    expect(indexed[2].visual).toBeNull();
  });

  it('returns immutable composites and protects cached state from mutation', () => {
    const rawActions = [
      {
        id: 'immutable',
        params: { count: 1 },
        command: 'do-something',
        description: 'an action',
        visual: {
          backgroundColor: '#123456',
          textColor: '#abcdef',
        },
      },
    ];

    const composites = service.indexActions('actor-immutability', rawActions);

    expect(Object.isFrozen(composites[0])).toBe(true);
    expect(Object.isFrozen(composites[0].params)).toBe(true);
    expect(Object.isFrozen(composites[0].visual)).toBe(true);

    expect(() => {
      composites[0].params.count = 99;
    }).toThrow(TypeError);

    expect(() => {
      composites[0].visual.backgroundColor = '#ffffff';
    }).toThrow(TypeError);

    const resolved = service.resolve('actor-immutability', 1);
    expect(resolved.params.count).toBe(1);
    expect(resolved.visual.backgroundColor).toBe('#123456');
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
      'ActionIndexingService: actor "actor1" suppressed 1 duplicate actions: a (cmd1, params: {"x":1}) x2'
    );
  });

  it('returns cached actions when discovery returns an empty list', () => {
    const actorId = 'actor-cache-retain';
    const rawActions = [
      {
        id: 'keep',
        params: { target: 'alpha' },
        command: 'cmd-keep',
        description: 'original action',
      },
    ];

    const firstResult = service.indexActions(actorId, rawActions);
    expect(firstResult).toHaveLength(1);
    expect(service.getIndexedList(actorId)).toHaveLength(1);

    const secondResult = service.indexActions(actorId, []);
    expect(secondResult).toHaveLength(1);
    expect(secondResult).toEqual(firstResult);
    expect(secondResult).not.toBe(firstResult);

    const cachedList = service.getIndexedList(actorId);
    expect(cachedList).toHaveLength(1);
    expect(cachedList).toEqual(firstResult);
    expect(service.resolve(actorId, 1)).toEqual(firstResult[0]);
  });

  it('indexes zero actions when discovery list is empty for the first time', () => {
    const actorId = 'actor-empty-initial';
    const result = service.indexActions(actorId, []);

    expect(result).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      'ActionIndexingService: indexed 0 actions for actor-empty-initial (no discoveries provided)'
    );
    expect(service.getIndexedList(actorId)).toEqual([]);
  });

  it('skips malformed discovered entries without throwing', () => {
    const rawActions = [
      null,
      { id: '', command: 'noop' },
      { id: 'valid', command: 'cmd-ok', params: { foo: 'bar' } },
      { id: 'broken', command: 42 },
    ];

    const result = service.indexActions('actor-invalid', rawActions);

    expect(result).toHaveLength(1);
    expect(result[0].actionId).toBe('valid');
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionIndexingService: actor "actor-invalid" ignored 3 invalid action entries.',
      expect.objectContaining({
        examples: expect.arrayContaining([
          expect.objectContaining({ reason: expect.any(String) }),
        ]),
      })
    );
  });

  it('treats actions with differently ordered params as duplicates', () => {
    const rawActions = [
      {
        id: 'dup',
        params: { alpha: 1, beta: 2 },
        command: 'cmdDup',
        description: 'original',
      },
      {
        id: 'dup',
        params: { beta: 2, alpha: 1 },
        command: 'cmdDup',
        description: 'order changed',
      },
    ];

    const result = service.indexActions('actorKeyOrder', rawActions);

    expect(result).toHaveLength(1);
    expect(result[0].actionId).toBe('dup');
    expect(logger.info).toHaveBeenCalledWith(
      'ActionIndexingService: actor "actorKeyOrder" suppressed 1 duplicate actions: dup (cmdDup, params: {"alpha":1,"beta":2}) x2'
    );
  });

  it('safely logs duplicate parameters that include BigInt values', () => {
    const rawActions = [
      {
        id: 'big',
        params: { value: 1n },
        command: 'cmd',
        description: 'first',
      },
      {
        id: 'big',
        params: { value: 1n },
        command: 'cmd',
        description: 'duplicate',
      },
    ];

    const result = service.indexActions('actorBigInt', rawActions);

    expect(result).toHaveLength(1);
    expect(logger.info).toHaveBeenCalledWith(
      'ActionIndexingService: actor "actorBigInt" suppressed 1 duplicate actions: big (cmd, params: {"value":1n}) x2'
    );
  });

  it('treats Map parameters with different entries as distinct actions', () => {
    const actionAParams = new Map([
      ['targetId', 'alpha'],
      ['stance', 'aggressive'],
    ]);
    const actionBParams = new Map([
      ['targetId', 'beta'],
      ['stance', 'defensive'],
    ]);

    const rawActions = [
      {
        id: 'map-action',
        params: actionAParams,
        command: 'cmd-map',
        description: 'First map action',
      },
      {
        id: 'map-action',
        params: actionBParams,
        command: 'cmd-map',
        description: 'Second map action',
      },
    ];

    const result = service.indexActions('actorMap', rawActions);

    expect(result).toHaveLength(2);
    expect(result[0].params).not.toBe(actionAParams);
    expect(result[1].params).not.toBe(actionBParams);
    expect(Array.from(result[0].params.entries())).toEqual(
      Array.from(actionAParams.entries())
    );
    expect(Array.from(result[1].params.entries())).toEqual(
      Array.from(actionBParams.entries())
    );
    expect(() => result[0].params.set('new', 'value')).toThrow(TypeError);
    expect(() => result[1].params.clear()).toThrow(TypeError);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('treats Date parameters with different timestamps as distinct actions', () => {
    const morning = new Date('2024-03-15T08:30:00.000Z');
    const evening = new Date('2024-03-15T20:45:00.000Z');

    const rawActions = [
      {
        id: 'time-sensitive',
        params: { scheduledAt: morning },
        command: 'cmd-time',
        description: 'Morning option',
      },
      {
        id: 'time-sensitive',
        params: { scheduledAt: evening },
        command: 'cmd-time',
        description: 'Evening option',
      },
    ];

    const result = service.indexActions('actorDate', rawActions);

    expect(result).toHaveLength(2);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('does not merge NaN, Infinity, or null parameter values together', () => {
    const rawActions = [
      {
        id: 'numeric',
        params: { value: NaN },
        command: 'cmd',
        description: 'NaN value',
      },
      {
        id: 'numeric',
        params: { value: null },
        command: 'cmd',
        description: 'null value',
      },
      {
        id: 'numeric',
        params: { value: Infinity },
        command: 'cmd',
        description: 'Infinity value',
      },
      {
        id: 'numeric',
        params: { value: -Infinity },
        command: 'cmd',
        description: '-Infinity value',
      },
    ];

    const result = service.indexActions('actorNumeric', rawActions);

    expect(result).toHaveLength(4);
    expect(logger.info).not.toHaveBeenCalled();
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
    const second = service.indexActions('actor42', raw);

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  describe('beginTurn', () => {
    it('clears cached actions for the actor', () => {
      // First index some actions
      const raw = [
        { id: 'a', params: {}, command: 'cmd', description: 'desc' },
      ];
      service.indexActions('actor1', raw);

      // Verify they're cached
      expect(() => service.getIndexedList('actor1')).not.toThrow();

      // Begin new turn
      service.beginTurn('actor1');

      // Verify cache is cleared
      expect(() => service.getIndexedList('actor1')).toThrow(
        ActionIndexingError
      );
    });

    it('is idempotent - can be called multiple times safely', () => {
      service.beginTurn('actor1');
      service.beginTurn('actor1');
      service.beginTurn('actor1');

      // Should not throw
      expect(() => service.getIndexedList('actor1')).toThrow(
        ActionIndexingError
      );
    });

    it('only clears cache for the specified actor', () => {
      // Index actions for multiple actors
      const raw = [
        { id: 'a', params: {}, command: 'cmd', description: 'desc' },
      ];
      service.indexActions('actor1', raw);
      service.indexActions('actor2', raw);

      // Begin turn for only actor1
      service.beginTurn('actor1');

      // actor1 cache should be cleared
      expect(() => service.getIndexedList('actor1')).toThrow(
        ActionIndexingError
      );

      // actor2 cache should remain
      expect(() => service.getIndexedList('actor2')).not.toThrow();
    });
  });

  describe('clearActorCache (deprecated)', () => {
    it('clears cached actions for the actor and logs debug message', () => {
      // First index some actions
      const raw = [
        { id: 'a', params: {}, command: 'cmd', description: 'desc' },
      ];
      service.indexActions('actor1', raw);

      // Clear cache
      service.clearActorCache('actor1');

      // Verify cache is cleared
      expect(() => service.getIndexedList('actor1')).toThrow(
        ActionIndexingError
      );

      // Verify debug log
      expect(logger.debug).toHaveBeenCalledWith(
        'ActionIndexingService: cache cleared for actor1'
      );
    });
  });

  it('resets between turns and re-suppresses duplicates per actor', () => {
    service.indexActions('actorA', [
      { id: 'a', params: {}, command: 'c', description: 'd' },
      { id: 'a', params: {}, command: 'c', description: 'dup' },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      'ActionIndexingService: actor "actorA" suppressed 1 duplicate actions: a (c) x2'
    );

    service.indexActions('actorB', [
      { id: 'a', params: {}, command: 'c', description: 'd' },
      { id: 'a', params: {}, command: 'c', description: 'dup' },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      'ActionIndexingService: actor "actorB" suppressed 1 duplicate actions: a (c) x2'
    );
  });

  it('throws if getIndexedList called before indexActions', () => {
    expect(() => service.getIndexedList('actorX')).toThrow(ActionIndexingError);
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

  it('indexActions returns a defensive copy for fresh indexing results', () => {
    const raw = [
      { id: 'a', params: {}, command: 'c', description: 'd' },
      { id: 'b', params: {}, command: 'c2', description: 'd2' },
    ];
    const indexed = service.indexActions('actorCopy', raw);
    indexed.pop();
    const cachedList = service.getIndexedList('actorCopy');
    expect(cachedList).toHaveLength(2);
  });

  it('indexActions returns a defensive copy on repeated indexing within a turn', () => {
    const raw = [
      { id: 'a', params: {}, command: 'c', description: 'd' },
      { id: 'b', params: {}, command: 'c2', description: 'd2' },
    ];
    service.indexActions('actorReuse', raw);
    const reused = service.indexActions('actorReuse', raw);
    reused.pop();
    const cachedList = service.getIndexedList('actorReuse');
    expect(cachedList).toHaveLength(2);
  });

  it('resolve throws if called before indexActions', () => {
    expect(() => service.resolve('actorZ', 1)).toThrow(ActionIndexingError);
  });

  it('resolve throws if index out of range', () => {
    service.indexActions('actorZ', [
      { id: 'x', params: {}, command: 'cmd', description: 'desc' },
    ]);
    expect(() => service.resolve('actorZ', 2)).toThrow(ActionIndexingError);
  });

  it('resolve returns correct action composite when index is valid', () => {
    const rawActions = [
      {
        id: 'action1',
        params: { key: 'value1' },
        command: 'cmd1',
        description: 'desc1',
      },
      {
        id: 'action2',
        params: { key: 'value2' },
        command: 'cmd2',
        description: 'desc2',
      },
      {
        id: 'action3',
        params: { key: 'value3' },
        command: 'cmd3',
        description: 'desc3',
      },
    ];

    service.indexActions('actorResolve', rawActions);

    // Test resolving each action
    const resolved1 = service.resolve('actorResolve', 1);
    expect(resolved1).toEqual({
      index: 1,
      actionId: 'action1',
      commandString: 'cmd1',
      params: { key: 'value1' },
      description: 'desc1',
      visual: null,
    });

    const resolved2 = service.resolve('actorResolve', 2);
    expect(resolved2).toEqual({
      index: 2,
      actionId: 'action2',
      commandString: 'cmd2',
      params: { key: 'value2' },
      description: 'desc2',
      visual: null,
    });

    const resolved3 = service.resolve('actorResolve', 3);
    expect(resolved3).toEqual({
      index: 3,
      actionId: 'action3',
      commandString: 'cmd3',
      params: { key: 'value3' },
      description: 'desc3',
      visual: null,
    });
  });
});
