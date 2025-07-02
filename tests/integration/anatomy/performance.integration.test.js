import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';

describe('Anatomy Performance Integration', () => {
  let testBed;
  let bodyGraphService;
  let validator;

  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    CACHE_OPERATIONS: 500, // 0.5 seconds for cache rebuild
    VALIDATION: 2000, // 2 seconds for large graph validation
    BATCH_OPERATIONS: 3000, // 3 seconds for batch detachment
  };

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();

    bodyGraphService = new BodyGraphService({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
      eventDispatcher: testBed.eventDispatcher,
    });

    validator = new GraphIntegrityValidator({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
    });

    // Load anatomy components
    testBed.loadComponents({
      'anatomy:body': {
        id: 'anatomy:body',
        data: { rootPartId: null, recipeId: null, body: null },
      },
      'anatomy:joint': {
        id: 'anatomy:joint',
        data: { parentId: null, socketId: null, jointType: null },
      },
      'anatomy:part': {
        id: 'anatomy:part',
        data: { subType: null },
      },
      'anatomy:sockets': {
        id: 'anatomy:sockets',
        data: { sockets: [] },
      },
    });

    // Load performance test entity definitions
    testBed.loadEntityDefinitions({
      'perf:torso': {
        id: 'perf:torso',
        components: {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': {
            sockets: [
              { id: 'socket_1', allowedTypes: ['limb'], maxCount: 5 },
              { id: 'socket_2', allowedTypes: ['limb'], maxCount: 5 },
              { id: 'socket_3', allowedTypes: ['limb'], maxCount: 5 },
              { id: 'socket_4', allowedTypes: ['limb'], maxCount: 5 },
            ],
          },
        },
      },
      'perf:limb': {
        id: 'perf:limb',
        components: {
          'anatomy:part': { subType: 'limb' },
        },
      },
    });
  });

  afterEach(() => {
    // No cleanup needed for test bed
  });

  describe('Cache Performance', () => {
    it('should rebuild cache efficiently after modifications', async () => {
      // Create a simple anatomy
      const torso = testBed.entityManager.createEntityInstance('perf:torso');
      const parts = [torso];

      // Create 5 limbs
      for (let i = 0; i < 5; i++) {
        const limb = testBed.entityManager.createEntityInstance('perf:limb');
        parts.push(limb);
        testBed.entityManager.addComponent(limb.id, 'anatomy:joint', {
          parentId: torso.id,
          socketId: `socket_${(i % 4) + 1}`,
        });
      }

      // Initial cache build
      bodyGraphService.buildAdjacencyCache(torso.id);

      // Detach one part
      if (parts.length > 2) {
        await bodyGraphService.detachPart(parts[2].id);
      }

      const startTime = Date.now();

      // Rebuild cache
      bodyGraphService.buildAdjacencyCache(torso.id);

      const endTime = Date.now();
      const rebuildTime = endTime - startTime;

      expect(rebuildTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_OPERATIONS);

      console.log(`Cache rebuild: ${rebuildTime}ms`);
    });

    it('should handle frequent cache operations efficiently', () => {
      const torso = testBed.entityManager.createEntityInstance('perf:torso');
      const limbs = [];

      // Create 2 limbs
      for (let i = 0; i < 2; i++) {
        const limb = testBed.entityManager.createEntityInstance('perf:limb');
        limbs.push(limb);
        testBed.entityManager.addComponent(limb.id, 'anatomy:joint', {
          parentId: torso.id,
          socketId: 'socket_1',
        });
      }

      const startTime = Date.now();

      // Perform many cache operations
      for (let i = 0; i < 10; i++) {
        bodyGraphService.buildAdjacencyCache(torso.id);
        if (limbs.length > 0) {
          bodyGraphService.getAnatomyRoot(limbs[0].id);
        }
      }

      const endTime = Date.now();
      const operationsTime = endTime - startTime;

      expect(operationsTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.CACHE_OPERATIONS
      );

      console.log(`10 cache operations: ${operationsTime}ms`);
    });
  });

  describe('Validation Performance', () => {
    it('should validate graphs within time limit', async () => {
      // Create entities for validation
      const entityIds = [];
      const torso = testBed.entityManager.createEntityInstance('perf:torso');
      entityIds.push(torso.id);

      // Create 10 limbs
      for (let i = 0; i < 10; i++) {
        const limb = testBed.entityManager.createEntityInstance('perf:limb');
        entityIds.push(limb.id);
        testBed.entityManager.addComponent(limb.id, 'anatomy:joint', {
          parentId: torso.id,
          socketId: `socket_${(i % 4) + 1}`,
        });
      }

      // Create socket occupancy map
      const socketOccupancy = new Map();
      for (let i = 1; i <= 4; i++) {
        const count = Math.ceil(10 / 4);
        socketOccupancy.set(`${torso.id}:socket_${i}`, count);
      }

      const recipe = {
        constraints: {},
        slots: {
          torso: { type: 'torso', count: 1 },
          limbs: { type: 'limb', count: 10 },
        },
      };

      const startTime = Date.now();

      const result = await validator.validateGraph(
        entityIds,
        recipe,
        socketOccupancy
      );

      const endTime = Date.now();
      const validationTime = endTime - startTime;

      expect(result.valid).toBe(true);
      expect(validationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VALIDATION);

      console.log(
        `Validation of ${entityIds.length}-entity graph: ${validationTime}ms`
      );
    });

    it('should handle validation with constraints efficiently', async () => {
      const entityIds = [];

      // Create 5 parts
      for (let i = 0; i < 5; i++) {
        const part = testBed.entityManager.createEntityInstance('perf:limb');
        entityIds.push(part.id);
      }

      const recipe = {
        constraints: {},
        slots: {
          parts: { type: 'limb', count: 5 },
        },
      };

      const startTime = Date.now();

      const result = await validator.validateGraph(
        entityIds,
        recipe,
        new Map()
      );

      const endTime = Date.now();
      const validationTime = endTime - startTime;

      expect(result.valid).toBe(true);
      expect(validationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VALIDATION);

      console.log(`Constraint validation: ${validationTime}ms`);
    });
  });

  describe('Batch Operations Performance', () => {
    it('should handle batch detachment efficiently', async () => {
      const torso = testBed.entityManager.createEntityInstance('perf:torso');
      const limbsToDetach = [];

      // Create 6 limbs to detach
      for (let i = 0; i < 6; i++) {
        const limb = testBed.entityManager.createEntityInstance('perf:limb');
        limbsToDetach.push(limb);
        testBed.entityManager.addComponent(limb.id, 'anatomy:joint', {
          parentId: torso.id,
          socketId: `socket_${(i % 4) + 1}`,
        });
      }

      bodyGraphService.buildAdjacencyCache(torso.id);

      const startTime = Date.now();

      // Detach all limbs
      for (const limb of limbsToDetach) {
        await bodyGraphService.detachPart(limb.id);
      }

      const endTime = Date.now();
      const batchTime = endTime - startTime;

      expect(batchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BATCH_OPERATIONS);

      console.log(
        `Batch detachment of ${limbsToDetach.length} limbs: ${batchTime}ms`
      );
    });

    it('should handle concurrent operations without performance degradation', async () => {
      const torso = testBed.entityManager.createEntityInstance('perf:torso');
      const limbs = [];

      // Create 3 limbs
      for (let i = 0; i < 3; i++) {
        const limb = testBed.entityManager.createEntityInstance('perf:limb');
        limbs.push(limb);
        testBed.entityManager.addComponent(limb.id, 'anatomy:joint', {
          parentId: torso.id,
          socketId: `socket_${i + 1}`,
        });
      }

      bodyGraphService.buildAdjacencyCache(torso.id);

      const startTime = Date.now();

      // Perform concurrent operations
      const operations = [];
      for (let i = 0; i < 5; i++) {
        operations.push(
          new Promise((resolve) => {
            setTimeout(() => {
              // Just test basic operations
              const root = bodyGraphService.getAnatomyRoot(limbs[0].id);
              resolve({ root });
            }, Math.random() * 10);
          })
        );
      }

      const results = await Promise.all(operations);

      const endTime = Date.now();
      const concurrentTime = endTime - startTime;

      expect(concurrentTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.BATCH_OPERATIONS
      );
      expect(results.length).toBe(5);

      console.log(`5 concurrent operations: ${concurrentTime}ms`);
    });
  });

  describe('Performance Summary', () => {
    it('should demonstrate that anatomy operations are performant', () => {
      // This is a summary test to ensure the anatomy system performs well
      const torso = testBed.entityManager.createEntityInstance('perf:torso');

      // Create parts
      const startCreate = Date.now();
      const parts = [];
      for (let i = 0; i < 20; i++) {
        const limb = testBed.entityManager.createEntityInstance('perf:limb');
        parts.push(limb);
      }
      const createTime = Date.now() - startCreate;

      // Add joints
      const startJoint = Date.now();
      for (let i = 0; i < parts.length; i++) {
        testBed.entityManager.addComponent(parts[i].id, 'anatomy:joint', {
          parentId: torso.id,
          socketId: `socket_${(i % 4) + 1}`,
        });
      }
      const jointTime = Date.now() - startJoint;

      // Build cache
      const startCache = Date.now();
      bodyGraphService.buildAdjacencyCache(torso.id);
      const cacheTime = Date.now() - startCache;

      console.log(
        `Performance Summary - Create: ${createTime}ms, Joint: ${jointTime}ms, Cache: ${cacheTime}ms`
      );

      // All operations should be fast
      expect(createTime).toBeLessThan(100);
      expect(jointTime).toBeLessThan(100);
      expect(cacheTime).toBeLessThan(100);
    });
  });
});
