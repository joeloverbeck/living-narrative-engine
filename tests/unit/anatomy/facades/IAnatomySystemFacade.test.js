/**
 * @file Comprehensive unit tests for IAnatomySystemFacade interface implementation behaviors
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import IAnatomySystemFacade from '../../../../src/anatomy/facades/IAnatomySystemFacade.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createEventBus = () => ({
  dispatch: jest.fn(),
  subscribe: jest.fn(),
});

const createCache = () => ({
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
  invalidate: jest.fn().mockResolvedValue(undefined),
  invalidateByPattern: jest.fn().mockResolvedValue(undefined),
});

const createBodyGraphService = () => ({
  getBodyParts: jest.fn().mockResolvedValue([]),
  buildGraph: jest
    .fn()
    .mockResolvedValue({ nodes: [], edges: [], properties: {} }),
  analyzeGraph: jest.fn().mockResolvedValue({}),
  getPartsByType: jest.fn().mockResolvedValue([]),
  getConnectedParts: jest.fn().mockResolvedValue([]),
  attachPart: jest.fn().mockResolvedValue({ success: true }),
  detachPart: jest.fn().mockResolvedValue({ success: true }),
  replacePart: jest.fn().mockResolvedValue({ success: true }),
  modifyPart: jest.fn().mockResolvedValue({ success: true }),
  getConstraints: jest.fn().mockResolvedValue({ rules: [], limits: {} }),
});

const createAnatomyDescriptionService = () => ({
  generateEntityDescription: jest
    .fn()
    .mockResolvedValue({ description: 'default description' }),
  generatePartDescription: jest
    .fn()
    .mockResolvedValue({
      description: 'part description',
      metadata: { tone: 'neutral' },
    }),
});

const createGraphIntegrityValidator = () => ({
  validateAttachment: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
  validateEntityGraph: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
});

const createAnatomyGenerationService = () => ({
  buildFromBlueprint: jest
    .fn()
    .mockResolvedValue({
      nodes: [],
      edges: [],
      properties: { generated: true },
    }),
  clearEntityAnatomy: jest.fn().mockResolvedValue({ success: true }),
});

const createBodyBlueprintFactory = () => ({
  validateBlueprint: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
});

const buildDependencies = (overrides = {}) => {
  const base = {
    logger: createLogger(),
    eventBus: createEventBus(),
    unifiedCache: createCache(),
    circuitBreaker: null,
    bodyGraphService: createBodyGraphService(),
    anatomyDescriptionService: createAnatomyDescriptionService(),
    graphIntegrityValidator: createGraphIntegrityValidator(),
    anatomyGenerationService: createAnatomyGenerationService(),
    bodyBlueprintFactory: createBodyBlueprintFactory(),
  };

  const merged = {
    ...base,
    ...overrides,
  };

  if (overrides.bodyGraphService) {
    merged.bodyGraphService = {
      ...base.bodyGraphService,
      ...overrides.bodyGraphService,
    };
  }
  if (overrides.anatomyDescriptionService) {
    merged.anatomyDescriptionService = {
      ...base.anatomyDescriptionService,
      ...overrides.anatomyDescriptionService,
    };
  }
  if (overrides.graphIntegrityValidator) {
    merged.graphIntegrityValidator = {
      ...base.graphIntegrityValidator,
      ...overrides.graphIntegrityValidator,
    };
  }
  if (overrides.anatomyGenerationService) {
    merged.anatomyGenerationService = {
      ...base.anatomyGenerationService,
      ...overrides.anatomyGenerationService,
    };
  }
  if (overrides.bodyBlueprintFactory) {
    merged.bodyBlueprintFactory = {
      ...base.bodyBlueprintFactory,
      ...overrides.bodyBlueprintFactory,
    };
  }
  if (overrides.unifiedCache) {
    merged.unifiedCache = { ...base.unifiedCache, ...overrides.unifiedCache };
  }
  if (overrides.logger) {
    merged.logger = { ...base.logger, ...overrides.logger };
  }
  if (overrides.eventBus) {
    merged.eventBus = { ...base.eventBus, ...overrides.eventBus };
  }

  return merged;
};

class TestAnatomySystemFacade extends IAnatomySystemFacade {
  constructor(overrides = {}) {
    const dependencies = buildDependencies(overrides);
    super(dependencies);
    this.__deps = dependencies;
  }
}

describe('IAnatomySystemFacade', () => {
  let facade;

  beforeEach(() => {
    facade = new TestAnatomySystemFacade();
  });

  describe('constructor behaviour', () => {
    it('creates facade instances through subclasses', () => {
      expect(facade).toBeInstanceOf(IAnatomySystemFacade);
    });

    it('throws when instantiated directly', () => {
      const dependencies = buildDependencies();
      expect(() => new IAnatomySystemFacade(dependencies)).toThrow(
        'Cannot instantiate abstract class IAnatomySystemFacade'
      );
    });
  });

  describe('query operations', () => {
    it('filters, sorts (asc) and paginates body parts while caching results', async () => {
      const parts = [
        { id: '1', type: 'arm', name: 'C' },
        { id: '2', type: 'arm', name: 'A' },
        { id: '3', type: 'arm', name: 'A' },
        { id: '4', type: 'leg', name: 'B' },
      ];
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getBodyParts: jest.fn().mockResolvedValue(parts),
        },
      });

      const response = await facade.getBodyParts('entity-1', {
        filters: { type: 'arm' },
        sortBy: 'name',
        sortOrder: 'asc',
        limit: 1,
        offset: 1,
        ttl: 120,
        requestId: 'req-1',
      });

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);
      expect(response.data[0].name).toBe('A');
      expect(response.pagination).toMatchObject({
        total: 3,
        count: 1,
        hasMore: true,
        limit: 1,
        offset: 1,
      });
      expect(facade.__deps.unifiedCache.set).toHaveBeenCalledWith(
        expect.stringContaining('anatomy:parts:entity-1'),
        expect.any(Object),
        { ttl: 120 }
      );
    });

    it('honours descending sort order for body parts', async () => {
      const parts = [
        { id: '1', type: 'arm', name: 'A' },
        { id: '2', type: 'arm', name: 'C' },
        { id: '3', type: 'arm', name: 'B' },
      ];
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getBodyParts: jest.fn().mockResolvedValue(parts),
        },
      });

      const response = await facade.getBodyParts('entity-2', {
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(response.data.map((part) => part.name)).toEqual(['C', 'B', 'A']);
    });

    it('provides fallback graph data when services fail', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          buildGraph: jest.fn().mockRejectedValue(new Error('graph down')),
          analyzeGraph: jest.fn().mockRejectedValue(new Error('analysis down')),
        },
      });

      const response = await facade.getBodyGraph('entity-3');

      expect(response.data).toEqual({ nodes: [], edges: [], properties: {} });
      expect(response.cached).toBe(false);
    });

    it('returns fallback list when part lookup fails', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getPartsByType: jest.fn().mockRejectedValue(new Error('boom')),
        },
      });

      const response = await facade.getPartByType('entity-4', 'arm');
      expect(response.data).toEqual([]);
      expect(response.pagination).toEqual({
        total: 0,
        count: 0,
        offset: 0,
        hasMore: false,
      });
    });

    it('returns fallback connected parts when graph lookup fails', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getConnectedParts: jest
            .fn()
            .mockRejectedValue(new Error('no connection')),
        },
      });

      const response = await facade.getConnectedParts('entity-5', 'part-1');
      expect(response.data).toEqual([]);
      expect(response.pagination).toEqual({
        total: 0,
        count: 0,
        offset: 0,
        hasMore: false,
      });
    });

    it('returns fallback body parts when retrieval fails', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getBodyParts: jest.fn().mockRejectedValue(new Error('unavailable')),
        },
      });

      const response = await facade.getBodyParts('entity-6');

      expect(response.success).toBe(true);
      expect(response.data).toEqual([]);
      expect(response.pagination.total).toBe(0);
    });

    it('uses default query options when omitted', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getBodyParts: jest.fn().mockResolvedValue([
            { id: '1', name: 'alpha' },
            { id: '2', name: 'beta' },
          ]),
        },
      });

      const response = await facade.getBodyParts('entity-7');

      expect(response.pagination.limit).toBeUndefined();
      expect(response.sortBy).toBeUndefined();
      expect(response.data.map((part) => part.name)).toEqual(['alpha', 'beta']);
    });

    it('fills missing graph properties with defaults', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          buildGraph: jest.fn().mockResolvedValue({}),
          analyzeGraph: jest.fn().mockResolvedValue({ summary: 'ok' }),
        },
      });

      const response = await facade.getBodyGraph('entity-8');

      expect(response.data).toEqual({ nodes: [], edges: [], properties: {} });
      expect(response.cached).toBe(false);
    });

    it('defaults sort order to ascending when not provided', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getBodyParts: jest.fn().mockResolvedValue([
            { id: '1', name: 'B' },
            { id: '2', name: 'A' },
          ]),
        },
      });

      const response = await facade.getBodyParts('entity-9', {
        sortBy: 'name',
        sortOrder: undefined,
      });

      expect(response.sortOrder).toBe('asc');
      expect(response.data.map((part) => part.name)).toEqual(['A', 'B']);
    });

    it('sorts parts ascending when explicitly requested', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getBodyParts: jest.fn().mockResolvedValue([
            { id: '1', name: 'C' },
            { id: '2', name: 'A' },
            { id: '3', name: 'B' },
          ]),
        },
      });

      const response = await facade.getBodyParts('entity-10', {
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(response.data.map((part) => part.name)).toEqual(['A', 'B', 'C']);
    });
  });

  describe('modification operations', () => {
    it('returns error response when attachment validation fails', async () => {
      facade = new TestAnatomySystemFacade({
        graphIntegrityValidator: {
          validateAttachment: jest
            .fn()
            .mockResolvedValue({ valid: false, errors: ['bad fit'] }),
        },
      });

      const response = await facade.attachPart(
        'entity-6',
        'part-A',
        'socket-Z',
        { validate: true }
      );

      expect(response.success).toBe(false);
      expect(response.error.type).toBe('InvalidArgumentError');
      expect(response.error.message).toContain('bad fit');
    });

    it('invalidates caches and dispatches events on successful attach', async () => {
      const eventBus = createEventBus();
      facade = new TestAnatomySystemFacade({ eventBus });

      const response = await facade.attachPart(
        'entity-7',
        'part-A',
        'socket-1',
        {
          notifyOnChange: true,
          requestId: 'attach-req',
        }
      );

      expect(response.success).toBe(true);
      expect(facade.__deps.unifiedCache.invalidate).toHaveBeenCalledWith(
        'anatomy:graph:entity-7'
      );
      expect(
        facade.__deps.unifiedCache.invalidateByPattern
      ).toHaveBeenCalledWith('anatomy:parts:entity-7:*');
      expect(facade.__deps.unifiedCache.invalidate).toHaveBeenCalledWith(
        'anatomy:connected-parts:entity-7:socket-1'
      );
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ANATOMY_PART_ATTACHED' })
      );
    });

    it('handles attachPart with default options', async () => {
      facade = new TestAnatomySystemFacade();

      const response = await facade.attachPart(
        'entity-8',
        'part-B',
        'socket-2'
      );

      expect(response.success).toBe(true);
      expect(facade.__deps.eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ANATOMY_PART_ATTACHED' })
      );
    });

    it('skips validation and notifications when disabled', async () => {
      const validator = jest.fn();
      const eventBus = createEventBus();
      facade = new TestAnatomySystemFacade({
        graphIntegrityValidator: { validateAttachment: validator },
        eventBus,
      });

      const response = await facade.attachPart(
        'entity-9',
        'part-C',
        'socket-3',
        {
          validate: false,
          notifyOnChange: false,
        }
      );

      expect(response.success).toBe(true);
      expect(validator).not.toHaveBeenCalled();
      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });

    it('invalidates parent caches and dispatches detach event when parent exists', async () => {
      const parentConnection = { partId: 'parent-1', relationship: 'parent' };
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getConnectedParts: jest.fn().mockResolvedValue([parentConnection]),
          detachPart: jest.fn().mockResolvedValue({ success: true }),
        },
      });

      const response = await facade.detachPart('entity-8', 'part-B', {
        notifyOnChange: true,
      });

      expect(response.changes.removed[0]).toMatchObject({
        parentPartId: 'parent-1',
      });
      expect(facade.__deps.unifiedCache.invalidate).toHaveBeenCalledWith(
        'anatomy:connected-parts:entity-8:parent-1'
      );
      expect(facade.__deps.eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ANATOMY_PART_DETACHED' })
      );
    });

    it('handles detachment when no parent exists', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getConnectedParts: jest.fn().mockResolvedValue([]),
          detachPart: jest.fn().mockResolvedValue({ success: true }),
        },
      });

      const response = await facade.detachPart('entity-10', 'part-C');

      expect(response.success).toBe(true);
      expect(response.changes.removed[0].parentPartId).toBeUndefined();
    });

    it('skips detachment notifications when disabled', async () => {
      const eventBus = createEventBus();
      facade = new TestAnatomySystemFacade({
        eventBus,
        bodyGraphService: {
          getConnectedParts: jest.fn().mockResolvedValue([]),
          detachPart: jest.fn().mockResolvedValue({ success: true }),
        },
      });

      await facade.detachPart('entity-11', 'part-D', { notifyOnChange: false });

      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });

    it('replaces parts and invalidates caches for all connections', async () => {
      const connections = [
        { partId: 'conn-1', relationship: 'sibling' },
        { partId: 'conn-2', relationship: 'child' },
      ];
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getConnectedParts: jest.fn().mockResolvedValue(connections),
          replacePart: jest.fn().mockResolvedValue({ success: true }),
        },
      });

      await facade.replacePart('entity-9', 'old-part', 'new-part');

      expect(facade.__deps.unifiedCache.invalidate).toHaveBeenCalledWith(
        'anatomy:graph:entity-9'
      );
      expect(
        facade.__deps.unifiedCache.invalidateByPattern
      ).toHaveBeenCalledWith('anatomy:parts:entity-9:*');
      expect(facade.__deps.unifiedCache.invalidate).toHaveBeenCalledWith(
        'anatomy:connected-parts:entity-9:conn-1'
      );
      expect(facade.__deps.unifiedCache.invalidate).toHaveBeenCalledWith(
        'anatomy:connected-parts:entity-9:conn-2'
      );
      expect(facade.__deps.eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ANATOMY_PART_REPLACED' })
      );
    });

    it('skips replacement notifications when disabled', async () => {
      const eventBus = createEventBus();
      facade = new TestAnatomySystemFacade({
        eventBus,
        bodyGraphService: {
          getConnectedParts: jest.fn().mockResolvedValue([]),
          replacePart: jest.fn().mockResolvedValue({ success: true }),
        },
      });

      await facade.replacePart('entity-12', 'old', 'new', {
        notifyOnChange: false,
      });

      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });

    it('returns error response when modifications payload is invalid', async () => {
      const response = await facade.modifyPart('entity-10', 'part-X', null);

      expect(response.success).toBe(false);
      expect(response.error.type).toBe('InvalidArgumentError');
    });

    it('modifies parts, invalidates caches and dispatches events when notifyOnChange is true', async () => {
      await facade.modifyPart('entity-11', 'part-Y', {
        size: 'large',
        status: 'healthy',
      });

      expect(
        facade.__deps.unifiedCache.invalidateByPattern
      ).toHaveBeenCalledWith('anatomy:parts:entity-11:*');
      expect(facade.__deps.unifiedCache.invalidate).toHaveBeenCalledWith(
        'anatomy:connected-parts:entity-11:part-Y'
      );
      expect(facade.__deps.eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ANATOMY_PART_MODIFIED' })
      );
    });

    it('skips modification notifications when disabled', async () => {
      const eventBus = createEventBus();
      facade = new TestAnatomySystemFacade({ eventBus });

      await facade.modifyPart(
        'entity-13',
        'part-Z',
        { power: 5 },
        { notifyOnChange: false }
      );

      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('graph operations', () => {
    it('returns error response when blueprint is not an object', async () => {
      const response = await facade.buildBodyGraph('entity-12', null);

      expect(response.success).toBe(false);
      expect(response.error.type).toBe('InvalidArgumentError');
    });

    it('returns error response when blueprint validation fails during build', async () => {
      facade = new TestAnatomySystemFacade({
        bodyBlueprintFactory: {
          validateBlueprint: jest
            .fn()
            .mockResolvedValue({ valid: false, errors: ['bad blueprint'] }),
        },
      });

      const response = await facade.buildBodyGraph(
        'entity-13',
        { type: 'test' },
        { validate: true }
      );

      expect(response.success).toBe(false);
      expect(response.error.type).toBe('InvalidArgumentError');
    });

    it('builds graphs, invalidates caches and dispatches events', async () => {
      const customService = createBodyGraphService();
      customService.buildGraph.mockResolvedValue({
        nodes: [{ id: 'node-1' }],
        edges: [],
        properties: {},
      });
      facade = new TestAnatomySystemFacade({ bodyGraphService: customService });

      const response = await facade.buildBodyGraph(
        'entity-14',
        { parts: [] },
        { notifyOnChange: true }
      );

      expect(response.data.nodes).toEqual([{ id: 'node-1' }]);
      expect(
        facade.__deps.unifiedCache.invalidateByPattern
      ).toHaveBeenCalledWith('anatomy:*:entity-14:*');
      expect(facade.__deps.eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ANATOMY_GRAPH_BUILT',
          payload: expect.objectContaining({ blueprintType: 'custom' }),
        })
      );
    });

    it('skips blueprint validation when disabled and does not dispatch events when notifyOnChange is false', async () => {
      const validator = jest.fn();
      const eventBus = createEventBus();
      facade = new TestAnatomySystemFacade({
        bodyBlueprintFactory: { validateBlueprint: validator },
        eventBus,
      });

      const response = await facade.buildBodyGraph(
        'entity-15',
        { parts: [] },
        { validate: false, notifyOnChange: false }
      );

      expect(response.success).toBe(true);
      expect(validator).not.toHaveBeenCalled();
      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });

    it('uses fallback validation response when validator fails', async () => {
      facade = new TestAnatomySystemFacade({
        graphIntegrityValidator: {
          validateEntityGraph: jest
            .fn()
            .mockRejectedValue(new Error('validation unavailable')),
        },
      });

      const response = await facade.validateGraph('entity-15');

      expect(response.data).toEqual({
        valid: false,
        errors: [{ message: 'Graph validation service unavailable' }],
      });
    });

    it('returns metadata when validation auto-fix is applied', async () => {
      facade = new TestAnatomySystemFacade({
        graphIntegrityValidator: {
          validateEntityGraph: jest.fn().mockResolvedValue({
            valid: true,
            errors: [],
            autoFixed: true,
          }),
        },
      });

      const response = await facade.validateGraph('entity-16', {
        fixIssues: true,
        requestId: 'val-1',
      });

      expect(response.metadata.requestId).toBe('val-1');
      expect(response.autoFixApplied).toBe(true);
      expect(response.data.autoFixed).toBe(true);
    });

    it('returns cached constraints fallback when service fails', async () => {
      facade = new TestAnatomySystemFacade({
        bodyGraphService: {
          getConstraints: jest
            .fn()
            .mockRejectedValue(new Error('no constraints')),
        },
      });

      const response = await facade.getGraphConstraints('entity-17');
      expect(response.data).toEqual({ rules: [], limits: {} });
    });
  });

  describe('description operations', () => {
    it('uses fallback entity description when generator fails', async () => {
      facade = new TestAnatomySystemFacade({
        anatomyDescriptionService: {
          generateEntityDescription: jest
            .fn()
            .mockRejectedValue(new Error('unavailable')),
          generatePartDescription: jest
            .fn()
            .mockResolvedValue({
              description: 'part description',
              metadata: {},
            }),
        },
      });

      const response = await facade.generateDescription('entity-18', {
        perspective: 'first-person',
        ttl: 30,
      });

      expect(response.data.description).toBe('Description unavailable');
      expect(response.data.perspective).toBe('first-person');
    });

    it('uses default entity description options when none are provided', async () => {
      const descriptionService = createAnatomyDescriptionService();
      descriptionService.generateEntityDescription.mockResolvedValue({
        description: 'ok',
      });
      facade = new TestAnatomySystemFacade({
        anatomyDescriptionService: descriptionService,
      });

      const response = await facade.generateDescription('entity-19');

      expect(response.success).toBe(true);
      expect(response.data.description).toBe('ok');
    });

    it('uses fallback part description when generator fails', async () => {
      facade = new TestAnatomySystemFacade({
        anatomyDescriptionService: {
          generateEntityDescription: jest
            .fn()
            .mockResolvedValue({ description: 'ok', metadata: {} }),
          generatePartDescription: jest
            .fn()
            .mockRejectedValue(new Error('nope')),
        },
      });

      const response = await facade.getPartDescription('entity-19', 'part-Z', {
        perspective: 'second-person',
      });

      expect(response.data.description).toBe('Part description unavailable');
      expect(response.data.partId).toBe('part-Z');
    });

    it('uses default part description options when none are provided', async () => {
      const descriptionService = createAnatomyDescriptionService();
      descriptionService.generatePartDescription.mockResolvedValue({
        description: 'fine',
        metadata: {},
      });
      facade = new TestAnatomySystemFacade({
        anatomyDescriptionService: descriptionService,
      });

      const response = await facade.getPartDescription('entity-20', 'part-AA');

      expect(response.success).toBe(true);
      expect(response.data.description).toBe('fine');
    });
  });

  describe('bulk operations', () => {
    it('returns error response when attachments input is not an array', async () => {
      const response = await facade.attachMultipleParts('entity-20', null);

      expect(response.success).toBe(false);
      expect(response.error.type).toBe('InvalidArgumentError');
    });

    it('processes attachments with default bulk options', async () => {
      const attachSpy = jest.spyOn(facade, 'attachPart');
      attachSpy.mockResolvedValue({ success: true });

      const response = await facade.attachMultipleParts('entity-21', [
        { partId: 'part-1', parentPartId: 'socket-1' },
      ]);

      expect(response.data.processed).toBe(1);
      expect(response.data.results).toHaveLength(0);
      expect(response.data.errors).toHaveLength(0);
    });

    it('processes attachments in parallel, collects errors and reports progress', async () => {
      const attachSpy = jest.spyOn(facade, 'attachPart');
      attachSpy.mockResolvedValueOnce({ success: true });
      attachSpy.mockRejectedValueOnce(new Error('failed attach'));
      const onProgress = jest.fn();

      const response = await facade.attachMultipleParts(
        'entity-21',
        [
          { partId: 'part-1', parentPartId: 'socket-1' },
          { partId: 'part-2', parentPartId: 'socket-1' },
        ],
        {
          batchSize: 1,
          parallel: true,
          stopOnError: false,
          returnResults: true,
          onProgress,
        }
      );

      expect(response.data).toMatchObject({
        processed: 2,
        successful: 1,
        failed: 1,
      });
      expect(response.data.results).toHaveLength(2);
      expect(response.data.errors).toHaveLength(1);
      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(facade.__deps.eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ANATOMY_BULK_ATTACH_COMPLETED' })
      );
    });

    it('stops attachment processing immediately when stopOnError is true', async () => {
      const attachSpy = jest.spyOn(facade, 'attachPart');
      attachSpy.mockRejectedValue(new Error('hard failure'));

      const response = await facade.attachMultipleParts(
        'entity-22',
        [{ partId: 'part-1', parentPartId: 'socket-1' }],
        { stopOnError: true }
      );

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('hard failure');
    });

    it('returns error response when detachment input is not an array', async () => {
      const response = await facade.detachMultipleParts('entity-23', 'part-1');

      expect(response.success).toBe(false);
      expect(response.error.type).toBe('InvalidArgumentError');
    });

    it('processes detachments with default bulk options', async () => {
      const detachSpy = jest.spyOn(facade, 'detachPart');
      detachSpy.mockResolvedValue({ success: true });

      const response = await facade.detachMultipleParts('entity-24', [
        'part-1',
      ]);

      expect(response.data.processed).toBe(1);
      expect(response.data.results).toHaveLength(0);
      expect(response.data.errors).toHaveLength(0);
    });

    it('processes detachments with progress reporting and error aggregation', async () => {
      const detachSpy = jest.spyOn(facade, 'detachPart');
      detachSpy.mockResolvedValueOnce({ success: true });
      detachSpy.mockRejectedValueOnce(new Error('detach failed'));
      const onProgress = jest.fn();

      const response = await facade.detachMultipleParts(
        'entity-24',
        ['part-1', 'part-2'],
        {
          batchSize: 1,
          parallel: true,
          stopOnError: false,
          returnResults: true,
          onProgress,
        }
      );

      expect(response.data).toMatchObject({
        processed: 2,
        successful: 1,
        failed: 1,
      });
      expect(response.data.errors).toHaveLength(1);
      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(facade.__deps.eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ANATOMY_BULK_DETACH_COMPLETED' })
      );
    });

    it('stops detachment processing on first failure when configured', async () => {
      const detachSpy = jest.spyOn(facade, 'detachPart');
      detachSpy.mockRejectedValue(new Error('critical failure'));

      const response = await facade.detachMultipleParts(
        'entity-25',
        ['part-1'],
        { stopOnError: true }
      );

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('critical failure');
    });
  });

  describe('rebuild operations', () => {
    it('returns error response when blueprint is missing', async () => {
      const response = await facade.rebuildFromBlueprint(
        'entity-26',
        undefined
      );

      expect(response.success).toBe(false);
      expect(response.error.type).toBe('InvalidArgumentError');
    });

    it('clears anatomy when cascading rebuild and dispatches rebuild event', async () => {
      const dependencies = buildDependencies();
      const cascadeFacade = new TestAnatomySystemFacade(dependencies);
      const buildSpy = jest.spyOn(cascadeFacade, 'buildBodyGraph');
      buildSpy.mockResolvedValue({
        success: true,
        data: { nodes: [{ id: 'rebuilt' }], edges: [], properties: {} },
        metadata: {},
      });

      const response = await cascadeFacade.rebuildFromBlueprint(
        'entity-27',
        { parts: [] },
        { cascade: true, notifyOnChange: true }
      );

      expect(
        dependencies.anatomyGenerationService.clearEntityAnatomy
      ).toHaveBeenCalledWith('entity-27');
      expect(
        dependencies.unifiedCache.invalidateByPattern
      ).toHaveBeenCalledWith('anatomy:*:entity-27:*');
      expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ANATOMY_GRAPH_REBUILT',
          payload: expect.objectContaining({ blueprintType: 'custom' }),
        })
      );
      expect(response.data.nodes).toEqual([{ id: 'rebuilt' }]);
    });

    it('skips cascade clearing and notifications when disabled', async () => {
      const dependencies = buildDependencies();
      const facadeNoCascade = new TestAnatomySystemFacade(dependencies);
      const buildSpy = jest.spyOn(facadeNoCascade, 'buildBodyGraph');
      buildSpy.mockResolvedValue({
        success: true,
        data: { nodes: [], edges: [], properties: {} },
        metadata: {},
      });

      const response = await facadeNoCascade.rebuildFromBlueprint(
        'entity-28',
        { parts: [] },
        { cascade: false, notifyOnChange: false }
      );

      expect(
        dependencies.anatomyGenerationService.clearEntityAnatomy
      ).not.toHaveBeenCalled();
      expect(dependencies.eventBus.dispatch).not.toHaveBeenCalled();
      expect(response.success).toBe(true);
      expect(response.data.nodes).toEqual([]);
    });
  });
});
