import { describe, it, expect, beforeEach } from '@jest/globals';
import { GraphBuildingWorkflow } from '../../../src/anatomy/workflows/graphBuildingWorkflow.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { GraphBuildingError } from '../../../src/anatomy/orchestration/anatomyErrorHandler.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

const ROOT_ID = 'body-root';
const ARM_ID = 'arm-left';
const HAND_ID = 'hand-left';

const buildEntityData = ({ includeRootPart = true } = {}) => [
  {
    id: ROOT_ID,
    components: {
      'anatomy:body': {
        root: ROOT_ID,
        body: {
          root: ROOT_ID,
          parts: {
            [ROOT_ID]: { children: [ARM_ID] },
            [ARM_ID]: { children: [HAND_ID] },
          },
        },
      },
      ...(includeRootPart
        ? {
            'anatomy:part': {
              type: 'torso',
              subType: 'torso',
            },
          }
        : {}),
    },
  },
  {
    id: ARM_ID,
    components: {
      'anatomy:part': { type: 'arm', subType: 'arm' },
      'anatomy:joint': { parentId: ROOT_ID, socketId: 'shoulder-socket' },
    },
  },
  {
    id: HAND_ID,
    components: {
      'anatomy:part': { type: 'hand', subType: 'hand' },
      'anatomy:joint': { parentId: ARM_ID, socketId: 'hand-socket' },
    },
  },
];

const createTestLogger = () => {
  const entries = [];
  const logger = {};
  ['debug', 'info', 'warn', 'error'].forEach((level) => {
    logger[level] = jest.fn((message, context) => {
      entries.push({ level, message, context });
    });
  });
  return { logger, entries };
};

const createRealWorkflow = ({ includeRootPart = true } = {}) => {
  const { logger, entries } = createTestLogger();
  const entityManager = new SimpleEntityManager(
    buildEntityData({ includeRootPart })
  );
  const eventDispatcher = { dispatch: jest.fn(async () => true) };
  const bodyGraphService = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });
  const workflow = new GraphBuildingWorkflow({
    entityManager,
    logger,
    bodyGraphService,
  });
  return { workflow, entityManager, bodyGraphService, entries, logger };
};

describe('GraphBuildingWorkflow integration', () => {
  describe('with real BodyGraphService', () => {
    let workflow;
    let bodyGraphService;
    let entries;

    beforeEach(() => {
      ({ workflow, bodyGraphService, entries } = createRealWorkflow({
        includeRootPart: false,
      }));
    });

    it('builds adjacency cache end-to-end even when the root part component is missing', async () => {
      await workflow.buildCache(ROOT_ID);

      expect(workflow.hasCacheForRoot(ROOT_ID)).toBe(true);
      expect(
        entries.some(
          (entry) =>
            entry.level === 'warn' &&
            entry.message.includes('does not have anatomy:part component')
        )
      ).toBe(true);

      const validation = await workflow.validateCache(ROOT_ID);
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('rejects missing root identifiers with InvalidArgumentError', async () => {
      await expect(workflow.buildCache()).rejects.toThrow(InvalidArgumentError);
    });
  });

  describe('error handling semantics', () => {
    it('wraps unexpected errors into GraphBuildingError', async () => {
      const { logger } = createTestLogger();
      const entityManager = new SimpleEntityManager(buildEntityData());
      const throwingService = {
        buildAdjacencyCache: jest.fn(async () => {
          throw new Error('boom');
        }),
        hasCache: jest.fn(() => false),
      };
      const workflow = new GraphBuildingWorkflow({
        entityManager,
        logger,
        bodyGraphService: throwingService,
      });

      await expect(workflow.buildCache(ROOT_ID)).rejects.toThrow(
        GraphBuildingError
      );
      expect(throwingService.buildAdjacencyCache).toHaveBeenCalledWith(ROOT_ID);
    });

    it('rebuildCache clears collaborator caches when supported and rebuilds state', async () => {
      const { logger } = createTestLogger();
      const entityManager = new SimpleEntityManager(buildEntityData());
      const cache = new Set();
      const bodyGraphService = {
        buildAdjacencyCache: jest.fn(async (rootId) => {
          cache.add(rootId);
        }),
        clearCache: jest.fn((rootId) => {
          cache.delete(rootId);
        }),
        hasCache: jest.fn((rootId) => cache.has(rootId)),
      };
      const workflow = new GraphBuildingWorkflow({
        entityManager,
        logger,
        bodyGraphService,
      });

      await workflow.buildCache(ROOT_ID);
      expect(workflow.hasCacheForRoot(ROOT_ID)).toBe(true);

      await workflow.rebuildCache(ROOT_ID);
      expect(bodyGraphService.clearCache).toHaveBeenCalledWith(ROOT_ID);
      expect(workflow.hasCacheForRoot(ROOT_ID)).toBe(true);
      expect(bodyGraphService.buildAdjacencyCache).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateCache orchestration', () => {
    it('marks result invalid when the root entity is missing', async () => {
      const { logger } = createTestLogger();
      const entityManager = new SimpleEntityManager([]);
      const bodyGraphService = {
        buildAdjacencyCache: jest.fn(),
      };
      const workflow = new GraphBuildingWorkflow({
        entityManager,
        logger,
        bodyGraphService,
      });

      const result = await workflow.validateCache(ROOT_ID);
      expect(result.valid).toBe(false);
      expect(result.issues).toEqual([`Root entity '${ROOT_ID}' not found`]);
    });

    it('collects all string-based issues returned by the body graph service', async () => {
      const { logger } = createTestLogger();
      const entityManager = new SimpleEntityManager(buildEntityData());
      const bodyGraphService = {
        buildAdjacencyCache: jest.fn(),
        validateCache: jest.fn(async () => [
          'missing child node',
          { note: 'ignored' },
          'orphan socket reference',
        ]),
      };
      const workflow = new GraphBuildingWorkflow({
        entityManager,
        logger,
        bodyGraphService,
      });

      const result = await workflow.validateCache(ROOT_ID);
      expect(bodyGraphService.validateCache).toHaveBeenCalledWith(ROOT_ID);
      expect(result.valid).toBe(false);
      expect(result.issues).toEqual([
        'missing child node',
        'orphan socket reference',
      ]);
    });

    it('merges structured validation issues and adds a default explanation when valid=false with no issues', async () => {
      const { logger } = createTestLogger();
      const entityManager = new SimpleEntityManager(buildEntityData());
      const bodyGraphService = {
        buildAdjacencyCache: jest.fn(),
        validateCache: jest.fn(async () => ({
          valid: false,
          issues: ['cache drift detected'],
        })),
      };
      const workflow = new GraphBuildingWorkflow({
        entityManager,
        logger,
        bodyGraphService,
      });

      const resultWithIssues = await workflow.validateCache(ROOT_ID);
      expect(resultWithIssues.valid).toBe(false);
      expect(resultWithIssues.issues).toContain('cache drift detected');

      bodyGraphService.validateCache = jest.fn(async () => ({ valid: false }));
      const resultWithoutIssues = await workflow.validateCache(ROOT_ID);
      expect(resultWithoutIssues.valid).toBe(false);
      expect(resultWithoutIssues.issues).toContain(
        `BodyGraphService reported invalid cache state for root entity '${ROOT_ID}'`
      );
    });

    it('records string responses and gracefully handles errors thrown by the body graph service', async () => {
      const { logger } = createTestLogger();
      const entityManager = new SimpleEntityManager(buildEntityData());
      const bodyGraphService = {
        buildAdjacencyCache: jest.fn(),
        validateCache: jest.fn(async () => 'dangling socket entry'),
      };
      const workflow = new GraphBuildingWorkflow({
        entityManager,
        logger,
        bodyGraphService,
      });

      const resultWithString = await workflow.validateCache(ROOT_ID);
      expect(resultWithString.valid).toBe(false);
      expect(resultWithString.issues).toEqual(['dangling socket entry']);

      bodyGraphService.validateCache = jest.fn(async () => {
        throw new Error('validation failed');
      });
      const erroredResult = await workflow.validateCache(ROOT_ID);
      expect(erroredResult.valid).toBe(false);
      expect(erroredResult.issues).toEqual([
        'Validation error: validation failed',
      ]);
    });
  });
});
