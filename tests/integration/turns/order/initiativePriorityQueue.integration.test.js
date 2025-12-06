/**
 * @file Integration tests for InitiativePriorityQueue using the real TinyQueue
 * collaborator and, where helpful, the TurnOrderService orchestration layer.
 * The goal is to exercise queue behaviors end-to-end without mocking collaborators.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { InitiativePriorityQueue } from '../../../../src/turns/order/queues/initiativePriorityQueue.js';
import { TurnOrderService } from '../../../../src/turns/order/turnOrderService.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';
import { createMockEntity } from '../../../common/mockFactories/entities.js';

describe('InitiativePriorityQueue integration', () => {
  const createEntity = (id) => ({ id });

  it('prioritizes entities by initiative and skips lazily removed entries when dequeuing', () => {
    const queue = new InitiativePriorityQueue();
    const wizard = createEntity('wizard');
    const rogue = createEntity('rogue');
    const fighter = createEntity('fighter');

    expect(queue.isEmpty()).toBe(true);

    queue.add(wizard, 18);
    queue.add(rogue, 12);
    queue.add(fighter, 9);

    expect(queue.isEmpty()).toBe(false);
    expect(queue.size()).toBe(3);

    const removedEntity = queue.remove('wizard');
    expect(removedEntity).toBe(wizard);
    expect(queue.size()).toBe(2);

    // Second removal attempt should find nothing because the entry is already marked removed
    expect(queue.remove('wizard')).toBeNull();
    expect(queue.size()).toBe(2);

    const first = queue.getNext();
    expect(first).toBe(rogue);
    expect(queue.size()).toBe(1);

    const second = queue.getNext();
    expect(second).toBe(fighter);
    expect(queue.isEmpty()).toBe(true);
    expect(queue.getNext()).toBeNull();
  });

  it('cleans lazily removed entries when peeking and preserves remaining entities', () => {
    const queue = new InitiativePriorityQueue();
    const alpha = createEntity('alpha');
    const beta = createEntity('beta');

    queue.add(alpha, 20);
    queue.add(beta, 10);

    expect(queue.peek()).toBe(alpha);

    queue.remove('alpha');
    expect(queue.size()).toBe(1);

    const peekAfterRemoval = queue.peek();
    expect(peekAfterRemoval).toBe(beta);
    expect(queue.size()).toBe(1);

    // peek should not consume the entity; getNext should now yield it
    expect(queue.getNext()).toBe(beta);
    expect(queue.isEmpty()).toBe(true);
  });

  it('returns active entities in initiative order and can reset completely via clear()', () => {
    const queue = new InitiativePriorityQueue();
    const sprinter = createEntity('sprinter');
    const cleric = createEntity('cleric');
    const ranger = createEntity('ranger');

    queue.add(sprinter, 5);
    queue.add(cleric, 17);
    queue.add(ranger, 11);

    queue.remove('sprinter');

    const ordered = queue.toArray();
    expect(ordered).toEqual([cleric, ranger]);

    // Ensure that toArray did not mutate queue state
    expect(queue.peek()).toBe(cleric);
    expect(queue.size()).toBe(2);

    queue.clear();
    expect(queue.size()).toBe(0);
    expect(queue.isEmpty()).toBe(true);
    expect(queue.peek()).toBeNull();
    expect(queue.toArray()).toEqual([]);
  });

  it('validates inputs defensively when adding or removing entities', () => {
    const queue = new InitiativePriorityQueue();
    const entity = createEntity('valid');

    expect(() => queue.add(null, 1)).toThrow(
      'InitiativePriorityQueue.add: Cannot add invalid entity (must have a valid string id).'
    );
    expect(() => queue.add({ id: '' }, 1)).toThrow(
      'InitiativePriorityQueue.add: Cannot add invalid entity (must have a valid string id).'
    );
    expect(() => queue.add(entity, Number.NaN)).toThrow(
      'InitiativePriorityQueue.add: Invalid priority value "NaN" for entity "valid". Priority must be a finite number.'
    );

    expect(queue.remove('')).toBeNull();
    expect(queue.remove(undefined)).toBeNull();
  });
});

describe('TurnOrderService with initiative strategy integration', () => {
  let turnOrderService;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    turnOrderService = new TurnOrderService({ logger });
  });

  afterEach(() => {
    logger.debug.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
  });

  it('uses InitiativePriorityQueue to manage turn progression with mixed initiative data', () => {
    const duelist = createMockEntity('duelist');
    const bard = createMockEntity('bard');
    const barbarian = createMockEntity('barbarian');

    const initiativeData = new Map([
      [duelist.id, 14],
      [bard.id, 8],
      [barbarian.id, Number.POSITIVE_INFINITY], // should be treated as invalid and default to 0
    ]);

    turnOrderService.startNewRound(
      [duelist, bard, barbarian],
      'initiative',
      initiativeData
    );

    expect(turnOrderService.peekNextEntity()).toBe(duelist);
    expect(turnOrderService.getNextEntity()).toBe(duelist);
    expect(turnOrderService.getNextEntity()).toBe(bard);

    // Barbarian should be last because invalid initiative defaults to 0
    expect(turnOrderService.getNextEntity()).toBe(barbarian);
    expect(turnOrderService.getNextEntity()).toBeNull();

    // Removing an entity should respect the queue's lazy removal strategy
    turnOrderService.startNewRound(
      [duelist, bard, barbarian],
      'initiative',
      initiativeData
    );
    turnOrderService.removeEntity(duelist.id);

    expect(turnOrderService.getNextEntity()).toBe(bard);
    expect(turnOrderService.getNextEntity()).toBe(barbarian);
    expect(turnOrderService.isEmpty()).toBe(true);
  });
});
