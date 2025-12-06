/**
 * @file Performance tests for furniture capacity edge cases and proximity boundaries
 * @description Tests performance characteristics including rapid sitting operations,
 * maximum capacity handling, and timing constraints for furniture interaction systems.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { performance } from 'perf_hooks';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createEntityInstance } from '../../common/entities/entityFactories.js';
import EstablishSittingClosenessHandler from '../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import * as closenessCircleService from '../../../src/logic/services/closenessCircleService.js';
import EventBus from '../../../src/events/eventBus.js';

describe('Furniture Capacity and Proximity Performance Tests', () => {
  let handler;
  let entityManager;
  let eventBus;
  let logger;
  let executionContext;

  beforeEach(() => {
    // Create mock logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create real services
    entityManager = new SimpleEntityManager();
    eventBus = new EventBus({ logger });

    // Create handler
    handler = new EstablishSittingClosenessHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
      closenessCircleService,
    });

    // Create execution context
    executionContext = {
      evaluationContext: {
        context: {},
      },
    };
  });

  afterEach(() => {
    entityManager = null;
    handler = null;
  });

  describe('Performance and Stress Testing', () => {
    it('should handle maximum capacity furniture efficiently', async () => {
      const furnitureId = 'test:huge_bench';
      const actorCount = 10;
      const actors = [];

      // Create furniture with maximum spots
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'positioning:allows_sitting': {
            spots: new Array(actorCount).fill(null),
          },
        },
      });
      entityManager.addEntity(furnitureEntity);

      // Create actors
      for (let i = 0; i < actorCount; i++) {
        const actorId = `test:perf_actor_${i}`;
        actors.push(actorId);

        const actorEntity = createEntityInstance({
          instanceId: actorId,
          baseComponents: {
            'core:actor': {},
          },
        });
        entityManager.addEntity(actorEntity);
      }

      const startTime = performance.now();

      // All actors sit down sequentially
      const spots = [...actors];
      await entityManager.addComponent(
        furnitureId,
        'positioning:allows_sitting',
        { spots }
      );

      for (let i = 0; i < actors.length; i++) {
        await entityManager.addComponent(actors[i], 'positioning:sitting_on', {
          furniture_id: furnitureId,
          spot_index: i,
        });

        // Establish closeness for each actor
        await handler.execute(
          {
            furniture_id: furnitureId,
            actor_id: actors[i],
            spot_index: i,
            result_variable: `actor${i}Closeness`,
          },
          executionContext
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete all sits in reasonable time
      expect(duration).toBeLessThan(1000); // <1 second for 10 actors

      // Verify all closeness relationships established correctly
      for (let i = 0; i < actorCount; i++) {
        const actorCloseness = entityManager.getComponent(
          actors[i],
          'positioning:closeness'
        );

        if (i === 0) {
          // First actor: only adjacent to second
          expect(actorCloseness.partners).toEqual([actors[1]]);
        } else if (i === actorCount - 1) {
          // Last actor: only adjacent to previous
          expect(actorCloseness.partners).toEqual([actors[actorCount - 2]]);
        } else {
          // Middle actors: adjacent to both neighbors
          expect(actorCloseness.partners).toContain(actors[i - 1]);
          expect(actorCloseness.partners).toContain(actors[i + 1]);
          expect(actorCloseness.partners.length).toBe(2);
        }
      }
    });

    it('should handle rapid sitting and standing operations', async () => {
      const furnitureId = 'test:rapid_bench';
      const actors = ['test:rapid1', 'test:rapid2', 'test:rapid3'];

      // Create furniture
      const furnitureEntity = createEntityInstance({
        instanceId: furnitureId,
        baseComponents: {
          'positioning:allows_sitting': {
            spots: [null, null, null],
          },
        },
      });
      entityManager.addEntity(furnitureEntity);

      // Create actors
      for (const actorId of actors) {
        const actorEntity = createEntityInstance({
          instanceId: actorId,
          baseComponents: {
            'core:actor': {},
          },
        });
        entityManager.addEntity(actorEntity);
      }

      // Perform rapid sit/stand cycles
      const cycles = 5;
      for (let cycle = 0; cycle < cycles; cycle++) {
        // All sit
        for (let i = 0; i < actors.length; i++) {
          await entityManager.addComponent(
            actors[i],
            'positioning:sitting_on',
            {
              furniture_id: furnitureId,
              spot_index: i,
            }
          );
        }

        await entityManager.addComponent(
          furnitureId,
          'positioning:allows_sitting',
          {
            spots: [...actors],
          }
        );

        // Establish closeness
        for (let i = 0; i < actors.length; i++) {
          await handler.execute(
            {
              furniture_id: furnitureId,
              actor_id: actors[i],
              spot_index: i,
              result_variable: 'closenessResult',
            },
            executionContext
          );
        }

        // Verify closeness established
        const middleActorCloseness = entityManager.getComponent(
          actors[1],
          'positioning:closeness'
        );
        expect(middleActorCloseness.partners.length).toBe(2);

        // All stand
        for (const actorId of actors) {
          entityManager.removeComponent(actorId, 'positioning:sitting_on');
          entityManager.removeComponent(actorId, 'positioning:closeness');
        }

        await entityManager.addComponent(
          furnitureId,
          'positioning:allows_sitting',
          {
            spots: [null, null, null],
          }
        );

        // Verify closeness removed
        for (const actorId of actors) {
          const closeness = entityManager.getComponent(
            actorId,
            'positioning:closeness'
          );
          expect(closeness).toBeNull();
        }
      }
    });
  });
});
