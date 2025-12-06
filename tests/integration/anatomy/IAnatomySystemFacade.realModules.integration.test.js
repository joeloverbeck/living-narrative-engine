import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import IAnatomySystemFacade from '../../../src/anatomy/facades/IAnatomySystemFacade.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import { DescriptionPersistenceService } from '../../../src/anatomy/DescriptionPersistenceService.js';
import { UnifiedCache } from '../../../src/cache/UnifiedCache.js';
import EventBus from '../../../src/events/eventBus.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

jest.setTimeout(30000);

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 */
function createEventDispatcher() {
  return {
    dispatch: jest.fn().mockResolvedValue(true),
  };
}

/**
 *
 * @param entityManager
 */
function seedAnatomy(entityManager) {
  const actorId = 'actor-1';
  const torsoId = 'torso-1';
  const leftArmId = 'left-arm-1';
  const rightArmId = 'right-arm-1';
  const leftHandId = 'left-hand-1';
  const heartId = 'heart-1';

  entityManager.addComponent(actorId, 'core:name', {
    text: 'Integration Actor',
  });
  entityManager.addComponent(actorId, 'core:description', {
    text: 'Base actor description',
  });

  entityManager.addComponent(torsoId, 'anatomy:part', {
    partType: 'torso',
    subType: 'torso',
  });
  entityManager.addComponent(torsoId, 'core:name', { text: 'Torso' });
  entityManager.addComponent(torsoId, 'core:description', {
    text: 'central torso',
  });

  entityManager.addComponent(leftArmId, 'anatomy:part', {
    partType: 'limb',
    subType: 'arm',
  });
  entityManager.addComponent(leftArmId, 'anatomy:joint', {
    parentId: torsoId,
    socketId: 'left_shoulder',
  });
  entityManager.addComponent(leftArmId, 'core:name', { text: 'Left Arm' });

  entityManager.addComponent(rightArmId, 'anatomy:part', {
    partType: 'limb',
    subType: 'arm',
  });
  entityManager.addComponent(rightArmId, 'anatomy:joint', {
    parentId: torsoId,
    socketId: 'right_shoulder',
  });
  entityManager.addComponent(rightArmId, 'core:name', { text: 'Right Arm' });

  entityManager.addComponent(leftHandId, 'anatomy:part', {
    partType: 'extremity',
    subType: 'hand',
  });
  entityManager.addComponent(leftHandId, 'anatomy:joint', {
    parentId: leftArmId,
    socketId: 'left_wrist',
  });
  entityManager.addComponent(leftHandId, 'core:name', { text: 'Left Hand' });

  entityManager.addComponent(heartId, 'anatomy:part', {
    partType: 'organ',
    subType: 'heart',
  });
  entityManager.addComponent(heartId, 'anatomy:joint', {
    parentId: torsoId,
    socketId: 'chest_cavity',
  });
  entityManager.addComponent(heartId, 'core:name', { text: 'Heart' });

  entityManager.addComponent(actorId, 'anatomy:body', {
    recipeId: 'integration_recipe',
    body: {
      root: torsoId,
      parts: {
        torso: torsoId,
        leftArm: leftArmId,
        rightArm: rightArmId,
        leftHand: leftHandId,
        heart: heartId,
      },
    },
  });

  return {
    actorId,
    torsoId,
    leftArmId,
    rightArmId,
    leftHandId,
    heartId,
  };
}

/**
 *
 * @param entityManager
 */
function createBodyPartDescriptionBuilder(entityManager) {
  return {
    buildDescription(entity) {
      const partComponent = entity.getComponentData('anatomy:part');
      const name = entity.getComponentData('core:name');
      const subType = partComponent?.subType || 'part';
      const label = name?.text || entity.id;
      return `${label} (${subType})`;
    },
  };
}

/**
 *
 * @param entityManager
 */
function createBodyDescriptionComposer(entityManager) {
  return {
    async composeDescription(entity) {
      const bodyComponent = entityManager.getComponentData(
        entity.id,
        'anatomy:body'
      );
      if (!bodyComponent?.body) {
        return 'No anatomy available';
      }
      const partIds = Object.values(bodyComponent.body.parts || {});
      const partNames = partIds.map((partId) => {
        const partName = entityManager.getComponentData(partId, 'core:name');
        return partName?.text || partId;
      });
      return `Body with ${partNames.length} parts: ${partNames.join(', ')}`;
    },
  };
}

/**
 *
 * @param entityManager
 * @param descriptionPersistenceService
 */
function createPartDescriptionGenerator(
  entityManager,
  descriptionPersistenceService
) {
  const generate = (partId) => {
    const partComponent = entityManager.getComponentData(
      partId,
      'anatomy:part'
    );
    const nameComponent = entityManager.getComponentData(partId, 'core:name');
    const subType = partComponent?.subType || 'part';
    const label = nameComponent?.text || partId;
    const descriptionText = `Detailed description of ${label} (${subType})`;
    descriptionPersistenceService.updateDescription(partId, descriptionText);
    return descriptionText;
  };

  return {
    generatePartDescription: generate,
    generateMultiplePartDescriptions(partIds) {
      const map = new Map();
      for (const partId of partIds) {
        map.set(partId, generate(partId));
      }
      return map;
    },
  };
}

/**
 *
 * @param entityManager
 */
function createComponentManager(entityManager) {
  return {
    addComponent: (entityId, componentId, data) => {
      entityManager.addComponent(entityId, componentId, data);
    },
    updateComponent: (entityId, componentId, data) => {
      entityManager.addComponent(entityId, componentId, data);
    },
  };
}

/**
 *
 * @param bodyGraphService
 * @param entityManager
 * @param root0
 * @param root0.logger
 */
function createBodyGraphAdapter(bodyGraphService, entityManager, { logger }) {
  const ensureBodyComponent = (entityId) => {
    const existing = entityManager.getComponentData(entityId, 'anatomy:body');
    if (existing?.body) {
      return existing;
    }
    const fallback = {
      recipeId: 'integration_recipe',
      body: { root: entityId, parts: {} },
    };
    entityManager.addComponent(entityId, 'anatomy:body', fallback);
    return fallback;
  };

  const ensurePartInBody = (entityId, partId, keyHint) => {
    const bodyComponent = ensureBodyComponent(entityId);
    const parts = { ...(bodyComponent.body?.parts || {}) };
    if (!Object.values(parts).includes(partId)) {
      const key =
        keyHint ||
        Object.keys(parts).find((existingKey) => !parts[existingKey]) ||
        `auto_${partId}`;
      parts[key] = partId;
      entityManager.addComponent(entityId, 'anatomy:body', {
        ...bodyComponent,
        body: {
          ...(bodyComponent.body || {}),
          root: bodyComponent.body?.root || partId,
          parts,
        },
      });
    }
  };

  const removePartFromBody = (entityId, partId) => {
    const bodyComponent = entityManager.getComponentData(
      entityId,
      'anatomy:body'
    );
    if (!bodyComponent?.body?.parts) {
      return;
    }
    const updated = { ...bodyComponent.body.parts };
    for (const [key, value] of Object.entries(updated)) {
      if (value === partId) {
        delete updated[key];
      }
    }
    entityManager.addComponent(entityId, 'anatomy:body', {
      ...bodyComponent,
      body: {
        ...(bodyComponent.body || {}),
        parts: updated,
      },
    });
  };

  const findBodyKeyForPart = (entityId, partId) => {
    const bodyComponent = entityManager.getComponentData(
      entityId,
      'anatomy:body'
    );
    if (!bodyComponent?.body?.parts) {
      return null;
    }
    for (const [key, value] of Object.entries(bodyComponent.body.parts)) {
      if (value === partId) {
        return key;
      }
    }
    return null;
  };

  const computeGraph = (entityId) => {
    const bodyComponent = ensureBodyComponent(entityId);
    const partIds = Array.from(
      new Set(Object.values(bodyComponent.body?.parts || {}))
    );

    const nodes = partIds.map((partId) => {
      const partData =
        entityManager.getComponentData(partId, 'anatomy:part') || {};
      const nameData =
        entityManager.getComponentData(partId, 'core:name') || {};
      return {
        id: partId,
        type: partData.subType || partData.partType || 'unknown',
        name: nameData.text || partId,
        metadata: { ...partData },
      };
    });

    const edges = partIds
      .map((partId) => {
        const joint = entityManager.getComponentData(partId, 'anatomy:joint');
        if (!joint?.parentId) {
          return null;
        }
        return {
          from: joint.parentId,
          to: partId,
          socketId: joint.socketId || null,
        };
      })
      .filter(Boolean);

    return {
      nodes,
      edges,
      properties: {
        root: bodyComponent.body?.root || entityId,
        partCount: nodes.length,
      },
    };
  };

  const adapter = {
    async getBodyParts(entityId) {
      const graph = computeGraph(entityId);
      return graph.nodes.map((node) => {
        const joint = entityManager.getComponentData(node.id, 'anatomy:joint');
        return {
          id: node.id,
          type: node.type,
          orientation: node.metadata.orientation || null,
          name: node.name,
          metadata: {
            ...node.metadata,
            joint: joint ? { ...joint } : undefined,
          },
        };
      });
    },

    async getPartsByType(entityId, partType) {
      const parts = await adapter.getBodyParts(entityId);
      return parts.filter((part) => part.type === partType);
    },

    async getConnectedParts(entityId, partId) {
      const graph = computeGraph(entityId);
      const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
      const connections = [];

      const parentEdge = graph.edges.find((edge) => edge.to === partId);
      if (parentEdge) {
        const parentNode = nodesById.get(parentEdge.from);
        connections.push({
          partId: parentEdge.from,
          relationship: 'parent',
          type: parentNode?.type || 'unknown',
          socketId: parentEdge.socketId || null,
          metadata: parentNode?.metadata || {},
        });
      }

      const childEdges = graph.edges.filter((edge) => edge.from === partId);
      for (const edge of childEdges) {
        const childNode = nodesById.get(edge.to);
        connections.push({
          partId: edge.to,
          relationship: 'child',
          type: childNode?.type || 'unknown',
          socketId: edge.socketId || null,
          metadata: childNode?.metadata || {},
        });
      }

      return connections;
    },

    async buildGraph(entityId) {
      return computeGraph(entityId);
    },

    async analyzeGraph(graph) {
      const typeCounts = graph.nodes.reduce((acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      }, {});

      return {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        rootId: graph.properties.root,
        typeCounts,
      };
    },

    async getConstraints(entityId) {
      const graph = computeGraph(entityId);
      return {
        rules: [],
        limits: {
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
        },
      };
    },

    async attachPart(entityId, partId, parentPartId, options = {}) {
      const socketId = options.socketId || `${parentPartId}-socket-${partId}`;
      ensurePartInBody(entityId, parentPartId);
      ensurePartInBody(entityId, partId, options.bodyKey);
      entityManager.addComponent(partId, 'anatomy:joint', {
        parentId: parentPartId,
        socketId,
      });
      logger.debug?.(
        `Adapter: Attached ${partId} to ${parentPartId} via ${socketId}`
      );
      return { partId, parentPartId, socketId };
    },

    async detachPart(entityId, partId) {
      const joint = entityManager.getComponentData(partId, 'anatomy:joint');
      entityManager.removeComponent(partId, 'anatomy:joint');
      removePartFromBody(entityId, partId);
      logger.debug?.(`Adapter: Detached ${partId}`);
      return {
        partId,
        parentId: joint?.parentId || null,
        socketId: joint?.socketId || null,
      };
    },

    async replacePart(entityId, oldPartId, newPartId) {
      const joint = entityManager.getComponentData(oldPartId, 'anatomy:joint');
      const key =
        findBodyKeyForPart(entityId, oldPartId) || `replaced_${oldPartId}`;
      removePartFromBody(entityId, oldPartId);
      ensurePartInBody(entityId, newPartId, key);
      if (joint?.parentId) {
        await adapter.attachPart(entityId, newPartId, joint.parentId, {
          socketId: joint.socketId,
          bodyKey: key,
        });
      }
      entityManager.removeComponent(oldPartId, 'anatomy:joint');
      return {
        oldPartId,
        newPartId,
        previousParent: joint?.parentId || null,
      };
    },

    async modifyPart(entityId, partId, modifications) {
      ensurePartInBody(entityId, partId);
      const existing =
        entityManager.getComponentData(partId, 'anatomy:part') || {};
      const updated = { ...existing, ...modifications };
      entityManager.addComponent(partId, 'anatomy:part', updated);
      logger.debug?.(`Adapter: Modified ${partId}`);
      return { partId, modifications: { ...modifications } };
    },
  };

  return adapter;
}

/**
 *
 * @param entityManager
 */
function createGraphValidator(entityManager) {
  return {
    async validateAttachment(_entityId, partId, parentPartId) {
      const joint = entityManager.getComponentData(partId, 'anatomy:joint');
      if (!joint) {
        return {
          valid: true,
          errors: [],
          warnings: [
            `No existing joint found for ${partId}; will attach to ${parentPartId}`,
          ],
        };
      }
      const valid = joint.parentId === parentPartId;
      return {
        valid,
        errors: valid
          ? []
          : [
              `Expected parent ${parentPartId} but found ${joint.parentId || 'none'}`,
            ],
        warnings: [],
      };
    },

    async validateEntityGraph(entityId) {
      const bodyComponent = entityManager.getComponentData(
        entityId,
        'anatomy:body'
      );
      const errors = [];
      const warnings = [];
      if (!bodyComponent?.body) {
        return { valid: false, errors: ['missing anatomy data'], warnings: [] };
      }

      const parts = Object.values(bodyComponent.body.parts || {});
      if (!bodyComponent.body.root) {
        warnings.push('No root defined for anatomy body');
      }

      const parentByChild = new Map();
      for (const partId of parts) {
        const joint = entityManager.getComponentData(partId, 'anatomy:joint');
        if (joint?.parentId) {
          parentByChild.set(partId, joint.parentId);
        }
      }

      const visited = new Set();
      const traverse = (currentId) => {
        if (!currentId || visited.has(currentId)) {
          return;
        }
        visited.add(currentId);
        for (const [childId, parentId] of parentByChild.entries()) {
          if (parentId === currentId) {
            traverse(childId);
          }
        }
      };

      traverse(bodyComponent.body.root);

      for (const partId of parts) {
        if (!visited.has(partId)) {
          errors.push(`Unreachable part ${partId}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },
  };
}

/**
 *
 * @param entityManager
 * @param bodyGraphAdapter
 */
function createAnatomyGenerationService(entityManager, bodyGraphAdapter) {
  return {
    async buildFromBlueprint(entityId, blueprint) {
      const parts = Array.isArray(blueprint?.parts) ? blueprint.parts : [];
      if (parts.length === 0) {
        return { built: false, reason: 'No parts provided' };
      }

      const rootPart = parts.find((part) => !part.parentId) || parts[0];
      const bodyComponent = entityManager.getComponentData(
        entityId,
        'anatomy:body'
      ) || {
        recipeId: blueprint?.recipeId || 'integration_recipe',
        body: { root: rootPart.id, parts: {} },
      };

      const partsMapping = {};
      for (const part of parts) {
        const key = part.key || part.subType || part.partType || part.id;
        partsMapping[key] = part.id;
      }

      entityManager.addComponent(entityId, 'anatomy:body', {
        ...bodyComponent,
        recipeId:
          blueprint?.recipeId || bodyComponent.recipeId || 'integration_recipe',
        body: {
          root: blueprint?.rootId || rootPart.id,
          parts: partsMapping,
        },
      });

      for (const part of parts) {
        entityManager.addComponent(part.id, 'anatomy:part', {
          partType: part.partType,
          subType: part.subType,
          orientation: part.orientation,
        });
        entityManager.addComponent(part.id, 'core:name', {
          text: part.name || part.id,
        });
        if (part.parentId) {
          await bodyGraphAdapter.attachPart(entityId, part.id, part.parentId, {
            socketId: part.socketId,
            bodyKey: part.key,
          });
        } else {
          entityManager.removeComponent(part.id, 'anatomy:joint');
        }
      }

      return {
        built: true,
        rootId: blueprint?.rootId || rootPart.id,
        partCount: parts.length,
      };
    },

    async clearEntityAnatomy(entityId) {
      const bodyComponent = entityManager.getComponentData(
        entityId,
        'anatomy:body'
      );
      if (!bodyComponent?.body) {
        return { cleared: false };
      }
      for (const partId of Object.values(bodyComponent.body.parts || {})) {
        entityManager.removeComponent(partId, 'anatomy:joint');
      }
      entityManager.addComponent(entityId, 'anatomy:body', {
        ...bodyComponent,
        body: {
          ...(bodyComponent.body || {}),
          parts: {},
        },
      });
      return { cleared: true };
    },

    async generateAnatomyIfNeeded(entityId) {
      const bodyComponent = entityManager.getComponentData(
        entityId,
        'anatomy:body'
      );
      return {
        generated: !bodyComponent,
        entityId,
      };
    },
  };
}

/**
 *
 */
function createBlueprintFactory() {
  return {
    async validateBlueprint(blueprint) {
      if (!blueprint || typeof blueprint !== 'object') {
        return {
          valid: false,
          errors: ['Blueprint must be an object'],
          warnings: [],
        };
      }
      const parts = Array.isArray(blueprint.parts) ? blueprint.parts : [];
      const ids = new Set(parts.map((part) => part.id));
      const errors = [];
      const rootId =
        blueprint.rootId || parts.find((part) => !part.parentId)?.id;
      if (!rootId || !ids.has(rootId)) {
        errors.push('Root part must be defined in blueprint');
      }
      for (const part of parts) {
        if (part.parentId && !ids.has(part.parentId)) {
          errors.push(`Parent ${part.parentId} missing for part ${part.id}`);
        }
      }
      return {
        valid: errors.length === 0,
        errors,
        warnings: [],
      };
    },
  };
}

/**
 *
 */
async function createIntegrationContext() {
  const entityManager = new SimpleEntityManager();
  const logger = createLogger();
  const eventDispatcher = createEventDispatcher();
  const ids = seedAnatomy(entityManager);

  const bodyGraphService = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  const descriptionPersistenceService = new DescriptionPersistenceService({
    logger,
    entityManager,
  });

  const bodyPartDescriptionBuilder =
    createBodyPartDescriptionBuilder(entityManager);
  const bodyDescriptionComposer = createBodyDescriptionComposer(entityManager);
  const partDescriptionGenerator = createPartDescriptionGenerator(
    entityManager,
    descriptionPersistenceService
  );
  const componentManager = createComponentManager(entityManager);

  const anatomyDescriptionService = new AnatomyDescriptionService({
    bodyPartDescriptionBuilder,
    bodyDescriptionComposer,
    bodyGraphService,
    entityFinder: entityManager,
    componentManager,
    eventDispatchService: { safeDispatchEvent: jest.fn() },
    partDescriptionGenerator,
    descriptionPersistenceService,
  });

  const descriptionAdapter = {
    async generateEntityDescription(entityId, descriptionOptions) {
      const entity = entityManager.getEntityInstance(entityId);
      if (!entity) {
        return {
          text: '',
          description: '',
          metadata: { missing: true },
        };
      }
      await anatomyDescriptionService.generateAllDescriptions(entity);
      const descriptionComponent = entityManager.getComponentData(
        entityId,
        'core:description'
      );
      const text = descriptionComponent?.text || '';
      return {
        text,
        description: text,
        metadata: {
          generatedAt: Date.now(),
          options: descriptionOptions,
        },
      };
    },

    async generatePartDescription(_entityId, partId) {
      anatomyDescriptionService.generatePartDescription(partId);
      const descriptionComponent = entityManager.getComponentData(
        partId,
        'core:description'
      );
      const text = descriptionComponent?.text || '';
      return {
        text,
        description: text,
        partId,
        metadata: {
          partId,
          generatedAt: Date.now(),
        },
      };
    },
  };

  const bodyGraphAdapter = createBodyGraphAdapter(
    bodyGraphService,
    entityManager,
    { logger }
  );
  const graphValidator = createGraphValidator(entityManager);
  const anatomyGenerationService = createAnatomyGenerationService(
    entityManager,
    bodyGraphAdapter
  );
  const bodyBlueprintFactory = createBlueprintFactory();

  const unifiedCache = new UnifiedCache({ logger });
  const eventBus = new EventBus({ logger });

  const facade = new IntegrationAnatomySystemFacade({
    bodyGraphService: bodyGraphAdapter,
    anatomyDescriptionService: descriptionAdapter,
    graphIntegrityValidator: graphValidator,
    anatomyGenerationService,
    bodyBlueprintFactory,
    logger,
    eventBus,
    unifiedCache,
  });

  return {
    entityManager,
    ids,
    actorId: ids.actorId,
    bodyGraphAdapter,
    graphValidator,
    anatomyGenerationService,
    bodyBlueprintFactory,
    anatomyDescriptionService,
    descriptionAdapter,
    unifiedCache,
    eventBus,
    facade,
    logger,
  };
}

class IntegrationAnatomySystemFacade extends IAnatomySystemFacade {}

describe('IAnatomySystemFacade integration (manual production wiring)', () => {
  let context;

  beforeEach(async () => {
    context = await createIntegrationContext();
    jest.spyOn(context.eventBus, 'dispatch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retrieves and caches filtered anatomy parts via production services', async () => {
    const { facade, bodyGraphAdapter, actorId, unifiedCache } = context;

    const allParts = await bodyGraphAdapter.getBodyParts(actorId);
    expect(allParts.length).toBeGreaterThan(0);

    const targetType =
      allParts.find((candidate, _index, array) =>
        array.some(
          (other) => other !== candidate && other.type === candidate.type
        )
      )?.type || allParts[0].type;

    const sortedNamesForType = allParts
      .filter((part) => part.type === targetType)
      .map((part) => part.name)
      .sort((a, b) => a.localeCompare(b));

    const firstResponse = await facade.getBodyParts(actorId, {
      filters: { type: targetType },
      sortBy: 'name',
      sortOrder: 'asc',
      limit: 2,
      offset: 0,
      ttl: 750,
    });

    expect(firstResponse.success).toBe(true);
    expect(firstResponse.data.map((part) => part.name)).toEqual(
      sortedNamesForType.slice(0, 2)
    );
    expect(firstResponse.pagination.total).toBeGreaterThanOrEqual(
      sortedNamesForType.length
    );

    const metricsAfterFirst = unifiedCache.getMetrics().stats;
    expect(metricsAfterFirst.misses).toBeGreaterThan(0);

    const secondResponse = await facade.getBodyParts(actorId, {
      filters: { type: targetType },
      sortBy: 'name',
      sortOrder: 'asc',
      limit: 2,
      offset: 0,
      ttl: 750,
    });

    expect(secondResponse.success).toBe(true);
    expect(secondResponse.data.map((part) => part.name)).toEqual(
      sortedNamesForType.slice(0, 2)
    );

    const metricsAfterSecond = unifiedCache.getMetrics().stats;
    expect(metricsAfterSecond.hits).toBeGreaterThan(0);
  });

  it('provides graph insights, constraints, and relationship queries', async () => {
    const { facade, actorId } = context;

    const graphResponse = await facade.getBodyGraph(actorId);
    expect(graphResponse.success).toBe(true);
    expect(graphResponse.data.nodes.length).toBeGreaterThan(0);
    expect(graphResponse.data.edges.length).toBeGreaterThan(0);

    const constraintsResponse = await facade.getGraphConstraints(actorId);
    expect(constraintsResponse.success).toBe(true);
    expect(constraintsResponse.data.limits.nodeCount).toBe(
      graphResponse.data.nodes.length
    );

    const sampleNode =
      graphResponse.data.nodes.find((node) => node.type !== 'unknown') ||
      graphResponse.data.nodes[0];
    const byTypeResponse = await facade.getPartByType(actorId, sampleNode.type);
    expect(byTypeResponse.success).toBe(true);
    expect(
      byTypeResponse.data.every((part) => part.type === sampleNode.type)
    ).toBe(true);

    const connectedResponse = await facade.getConnectedParts(
      actorId,
      sampleNode.id
    );
    expect(connectedResponse.success).toBe(true);
    expect(Array.isArray(connectedResponse.data)).toBe(true);
  });

  it('supports part lifecycle operations including bulk flows', async () => {
    const { facade, actorId, entityManager, eventBus, ids } = context;

    const newHandId = 'cyber-hand-1';
    entityManager.addComponent(newHandId, 'anatomy:part', {
      partType: 'extremity',
      subType: 'hand',
    });
    entityManager.addComponent(newHandId, 'core:name', { text: 'Cyber Hand' });

    const attachResponse = await facade.attachPart(
      actorId,
      newHandId,
      ids.leftArmId,
      {
        validate: true,
        notifyOnChange: true,
        socketId: 'cyber_socket',
        requestId: 'attach-cyber-hand',
      }
    );

    expect(attachResponse.success).toBe(true);
    expect(attachResponse.data.partId).toBe(newHandId);

    const invalidAttachment = await facade.attachPart(
      actorId,
      newHandId,
      ids.rightArmId,
      {
        validate: true,
        notifyOnChange: false,
      }
    );
    expect(invalidAttachment.success).toBe(false);
    expect(invalidAttachment.error.message).toContain('Invalid attachment');

    const modifyResponse = await facade.modifyPart(
      actorId,
      newHandId,
      { orientation: 'forward', material: 'alloy' },
      { notifyOnChange: true }
    );
    expect(modifyResponse.success).toBe(true);
    expect(modifyResponse.changes.modified[0].modifications).toContain(
      'orientation'
    );

    const replacementId = 'sleek-hand-1';
    entityManager.addComponent(replacementId, 'anatomy:part', {
      partType: 'extremity',
      subType: 'hand',
      orientation: 'forward',
    });
    entityManager.addComponent(replacementId, 'core:name', {
      text: 'Sleek Hand',
    });

    const replaceResponse = await facade.replacePart(
      actorId,
      newHandId,
      replacementId,
      {
        notifyOnChange: true,
      }
    );
    expect(replaceResponse.success).toBe(true);
    expect(replaceResponse.changes.removed[0].partId).toBe(newHandId);

    const detachResponse = await facade.detachPart(actorId, replacementId, {
      notifyOnChange: true,
    });
    expect(detachResponse.success).toBe(true);
    expect(detachResponse.changes.removed[0].partId).toBe(replacementId);

    const bulkFingerIds = ['finger-1', 'finger-2'];
    for (const fingerId of bulkFingerIds) {
      entityManager.addComponent(fingerId, 'anatomy:part', {
        partType: 'extremity',
        subType: 'finger',
      });
      entityManager.addComponent(fingerId, 'core:name', {
        text: `Finger ${fingerId}`,
      });
    }

    const progressSpy = jest.fn();
    const bulkAttachResponse = await facade.attachMultipleParts(
      actorId,
      bulkFingerIds.map((id) => ({ partId: id, parentPartId: ids.leftArmId })),
      {
        batchSize: 1,
        returnResults: true,
        onProgress: progressSpy,
        notifyOnChange: true,
      }
    );
    expect(bulkAttachResponse.success).toBe(true);
    expect(progressSpy).toHaveBeenCalled();

    const bulkDetachResponse = await facade.detachMultipleParts(
      actorId,
      bulkFingerIds,
      {
        batchSize: 2,
        returnResults: true,
        notifyOnChange: true,
      }
    );
    expect(bulkDetachResponse.success).toBe(true);

    expect(eventBus.dispatch).toHaveBeenCalled();
  });

  it('builds and rebuilds body graphs from blueprints', async () => {
    const { facade, actorId, entityManager, unifiedCache } = context;

    const blueprint = {
      type: 'cybernetic-upgrade',
      rootId: 'torso-1',
      parts: [
        { id: 'torso-1', name: 'Torso', partType: 'torso', subType: 'torso' },
        {
          id: 'exo-arm-1',
          name: 'Exo Arm',
          partType: 'limb',
          subType: 'arm',
          parentId: 'torso-1',
          socketId: 'exo_shoulder',
        },
      ],
    };

    const buildResponse = await facade.buildBodyGraph(actorId, blueprint, {
      validate: true,
      notifyOnChange: true,
    });

    expect(buildResponse.success).toBe(true);
    expect(buildResponse.data.nodes.length).toBeGreaterThanOrEqual(2);

    const secondBlueprint = {
      type: 'replacement-upgrade',
      rootId: 'torso-1',
      parts: [
        { id: 'torso-1', name: 'Torso', partType: 'torso', subType: 'torso' },
        {
          id: 'exo-arm-2',
          name: 'Advanced Exo Arm',
          partType: 'limb',
          subType: 'arm',
          parentId: 'torso-1',
          socketId: 'advanced_socket',
        },
        {
          id: 'exo-hand-2',
          name: 'Advanced Exo Hand',
          partType: 'extremity',
          subType: 'hand',
          parentId: 'exo-arm-2',
          socketId: 'exo_wrist',
        },
      ],
    };

    const rebuildResponse = await facade.rebuildFromBlueprint(
      actorId,
      secondBlueprint,
      {
        cascade: true,
        notifyOnChange: true,
      }
    );

    expect(rebuildResponse.success).toBe(true);
    expect(rebuildResponse.data.blueprint.type).toBe('replacement-upgrade');

    unifiedCache.clear();

    const graphAfterRebuild = await facade.getBodyGraph(actorId);
    const partIdsAfter = graphAfterRebuild.data.nodes.map((node) => node.id);
    expect(partIdsAfter).toEqual(
      expect.arrayContaining(['torso-1', 'exo-arm-2', 'exo-hand-2'])
    );
    expect(
      entityManager.getComponentData('exo-hand-2', 'anatomy:joint')?.parentId
    ).toBe('exo-arm-2');
  });

  it('produces entity and part descriptions through the assembled pipeline', async () => {
    const { facade, actorId, bodyGraphAdapter } = context;

    const bodyDescriptionResponse = await facade.generateDescription(actorId, {
      style: 'narrative',
      perspective: 'second',
      ttl: 1200,
      requestId: 'facade-description-integration',
    });

    expect(bodyDescriptionResponse.success).toBe(true);
    expect(bodyDescriptionResponse.data.description).toEqual(
      expect.any(String)
    );
    expect(bodyDescriptionResponse.data.description.length).toBeGreaterThan(0);

    const parts = await bodyGraphAdapter.getBodyParts(actorId);
    const focusPart = parts.find((part) => part.type !== 'unknown') || parts[0];

    const partDescriptionResponse = await facade.getPartDescription(
      actorId,
      focusPart.id,
      {
        style: 'narrative',
        perspective: 'second',
        requestId: 'facade-part-description-integration',
      }
    );

    expect(partDescriptionResponse.success).toBe(true);
    expect(partDescriptionResponse.data.description).toEqual(
      expect.any(String)
    );
    expect(partDescriptionResponse.data.partId).toBe(focusPart.id);
  });

  it('validates the anatomy graph using structural checks', async () => {
    const { facade, actorId } = context;

    const validationResponse = await facade.validateGraph(actorId);

    expect(validationResponse.success).toBe(true);
    expect(validationResponse.data.valid).toBe(true);
    expect(Array.isArray(validationResponse.data.errors)).toBe(true);
  });

  it('falls back to safe defaults when collaborators fail', async () => {
    const {
      facade,
      actorId,
      bodyGraphAdapter,
      graphValidator,
      descriptionAdapter,
      unifiedCache,
      ids,
    } = context;

    unifiedCache.clear();

    jest
      .spyOn(bodyGraphAdapter, 'getBodyParts')
      .mockRejectedValueOnce(new Error('parts failure'));
    const partsResponse = await facade.getBodyParts(actorId, {
      requestId: 'fallback-parts',
    });
    expect(partsResponse.success).toBe(true);
    expect(partsResponse.data).toEqual([]);
    expect(partsResponse.pagination.total).toBe(0);

    jest
      .spyOn(bodyGraphAdapter, 'buildGraph')
      .mockRejectedValueOnce(new Error('graph failure'));
    jest
      .spyOn(bodyGraphAdapter, 'analyzeGraph')
      .mockRejectedValueOnce(new Error('analysis failure'));
    const graphResponse = await facade.getBodyGraph(actorId);
    expect(graphResponse.success).toBe(true);
    expect(graphResponse.data.nodes).toEqual([]);
    expect(graphResponse.data.edges).toEqual([]);

    jest
      .spyOn(bodyGraphAdapter, 'getPartsByType')
      .mockRejectedValueOnce(new Error('parts by type failure'));
    const byTypeResponse = await facade.getPartByType(actorId, 'limb');
    expect(byTypeResponse.success).toBe(true);
    expect(byTypeResponse.data).toEqual([]);
    expect(byTypeResponse.pagination.total).toBe(0);

    jest
      .spyOn(bodyGraphAdapter, 'getConnectedParts')
      .mockRejectedValueOnce(new Error('connected failure'));
    const connectedResponse = await facade.getConnectedParts(
      actorId,
      ids.leftArmId
    );
    expect(connectedResponse.success).toBe(true);
    expect(connectedResponse.data).toEqual([]);

    jest
      .spyOn(graphValidator, 'validateEntityGraph')
      .mockRejectedValueOnce(new Error('validator failure'));
    const validationFallback = await facade.validateGraph(actorId, {
      requestId: 'fallback-validation',
    });
    expect(validationFallback.success).toBe(true);
    expect(validationFallback.data.valid).toBe(false);
    expect(validationFallback.data.errors[0].message).toBe(
      'Graph validation service unavailable'
    );

    jest
      .spyOn(bodyGraphAdapter, 'getConstraints')
      .mockRejectedValueOnce(new Error('constraints failure'));
    const constraintsResponse = await facade.getGraphConstraints(actorId);
    expect(constraintsResponse.success).toBe(true);
    expect(constraintsResponse.data.rules).toEqual([]);
    expect(constraintsResponse.data.limits).toEqual({});

    jest
      .spyOn(descriptionAdapter, 'generateEntityDescription')
      .mockRejectedValueOnce(new Error('description failure'));
    const descriptionResponse = await facade.generateDescription(actorId, {
      style: 'fallback',
      perspective: 'first',
      requestId: 'fallback-description',
      ttl: 5,
    });
    expect(descriptionResponse.success).toBe(true);
    expect(descriptionResponse.data.description).toBe(
      'Description unavailable'
    );

    jest
      .spyOn(descriptionAdapter, 'generatePartDescription')
      .mockRejectedValueOnce(new Error('part description failure'));
    const partDescriptionResponse = await facade.getPartDescription(
      actorId,
      ids.leftArmId,
      {
        style: 'fallback',
        perspective: 'first',
        requestId: 'fallback-part-description',
        ttl: 5,
      }
    );
    expect(partDescriptionResponse.success).toBe(true);
    expect(partDescriptionResponse.data.description).toBe(
      'Part description unavailable'
    );
  });

  it('validates input payloads and blueprints before performing operations', async () => {
    const { facade, actorId, ids } = context;

    const invalidModify = await facade.modifyPart(actorId, ids.leftArmId, null);
    expect(invalidModify.success).toBe(false);
    expect(invalidModify.error.message).toContain(
      'Modifications must be an object'
    );

    const invalidBlueprint = await facade.buildBodyGraph(actorId, null);
    expect(invalidBlueprint.success).toBe(false);
    expect(invalidBlueprint.error.message).toContain(
      'Blueprint must be an object'
    );

    const invalidValidatedBlueprint = await facade.buildBodyGraph(
      actorId,
      {
        type: 'invalid-blueprint',
        parts: [
          {
            id: 'floating-part',
            parentId: 'missing-parent',
            partType: 'extremity',
            subType: 'finger',
          },
        ],
      },
      { validate: true }
    );
    expect(invalidValidatedBlueprint.success).toBe(false);
    expect(invalidValidatedBlueprint.error.message).toContain(
      'Invalid blueprint'
    );

    const invalidBulkAttach = await facade.attachMultipleParts(actorId, {
      invalid: 'payload',
    });
    expect(invalidBulkAttach.success).toBe(false);
    expect(invalidBulkAttach.error.message).toContain('Parts must be an array');

    const invalidBulkDetach = await facade.detachMultipleParts(
      actorId,
      'invalid payload'
    );
    expect(invalidBulkDetach.success).toBe(false);
    expect(invalidBulkDetach.error.message).toContain(
      'Part IDs must be an array'
    );

    const invalidRebuild = await facade.rebuildFromBlueprint(actorId, null);
    expect(invalidRebuild.success).toBe(false);
    expect(invalidRebuild.error.message).toContain(
      'Blueprint must be an object'
    );
  });

  it('sorts body parts in descending order while handling duplicate keys', async () => {
    const { facade, actorId, entityManager, ids } = context;

    const duplicateId = 'duplicate-arm';
    entityManager.addComponent(duplicateId, 'anatomy:part', {
      partType: 'limb',
      subType: 'arm',
    });
    entityManager.addComponent(duplicateId, 'core:name', { text: 'Left Arm' });

    await facade.attachPart(actorId, duplicateId, ids.leftArmId, {
      notifyOnChange: false,
    });

    const response = await facade.getBodyParts(actorId, {
      sortBy: 'name',
      sortOrder: 'desc',
      requestId: 'descending-sort',
    });

    expect(response.success).toBe(true);
    const names = response.data.map((part) => part.name);
    const expected = [...names].sort((a, b) => b.localeCompare(a));
    expect(names).toEqual(expected);
    expect(
      names.filter((name) => name === 'Left Arm').length
    ).toBeGreaterThanOrEqual(2);
  });

  it('supports parallel bulk attachments with partial failures and progress updates', async () => {
    const { facade, actorId, entityManager, ids } = context;

    const validId = 'bulk-valid-finger';
    entityManager.addComponent(validId, 'anatomy:part', {
      partType: 'extremity',
      subType: 'finger',
    });
    entityManager.addComponent(validId, 'core:name', { text: 'Valid Finger' });

    const invalidId = 'bulk-invalid-finger';
    entityManager.addComponent(invalidId, 'anatomy:part', {
      partType: 'extremity',
      subType: 'finger',
    });
    entityManager.addComponent(invalidId, 'anatomy:joint', {
      parentId: ids.rightArmId,
      socketId: 'mismatched-socket',
    });
    entityManager.addComponent(invalidId, 'core:name', {
      text: 'Miswired Finger',
    });

    const progressSpy = jest.fn();

    const originalAttachPart = facade.attachPart.bind(facade);
    const attachSpy = jest.spyOn(facade, 'attachPart');
    attachSpy.mockImplementationOnce(async () => {
      throw new Error('forced attach failure');
    });
    attachSpy.mockImplementation(originalAttachPart);

    const response = await facade.attachMultipleParts(
      actorId,
      [
        { partId: validId, parentPartId: ids.leftArmId },
        { partId: invalidId, parentPartId: ids.leftArmId },
      ],
      {
        validate: true,
        notifyOnChange: false,
        batchSize: 1,
        parallel: true,
        returnResults: true,
        onProgress: progressSpy,
        stopOnError: false,
      }
    );

    expect(response.success).toBe(true);
    expect(response.data.successful).toBe(1);
    expect(response.data.failed).toBe(1);
    expect(response.data.errors[0].error).toBe('forced attach failure');
    expect(response.partial).toBe(true);
    expect(progressSpy).toHaveBeenCalled();
  });

  it('stops bulk attachment immediately when stopOnError is enabled', async () => {
    const { facade, actorId, entityManager, ids } = context;

    const invalidId = 'bulk-stop-finger';
    entityManager.addComponent(invalidId, 'anatomy:part', {
      partType: 'extremity',
      subType: 'finger',
    });
    entityManager.addComponent(invalidId, 'anatomy:joint', {
      parentId: ids.rightArmId,
      socketId: 'occupied-socket',
    });
    entityManager.addComponent(invalidId, 'core:name', { text: 'Stop Finger' });

    const originalAttachPart = facade.attachPart.bind(facade);
    const attachSpy = jest.spyOn(facade, 'attachPart');
    attachSpy.mockImplementationOnce(async () => {
      throw new Error('forced stop attach');
    });
    attachSpy.mockImplementation(originalAttachPart);

    const response = await facade.attachMultipleParts(
      actorId,
      [{ partId: invalidId, parentPartId: ids.leftArmId }],
      {
        validate: true,
        notifyOnChange: false,
        stopOnError: true,
      }
    );

    expect(response.success).toBe(false);
    expect(response.error.message).toBe('forced stop attach');
  });

  it('handles partial detach failures with parallel execution and progress reporting', async () => {
    const { facade, actorId, entityManager, ids } = context;

    const partA = 'bulk-detach-part-a';
    const partB = 'bulk-detach-part-b';
    entityManager.addComponent(partA, 'anatomy:part', {
      partType: 'extremity',
      subType: 'finger',
    });
    entityManager.addComponent(partA, 'core:name', { text: 'Detach Finger A' });
    entityManager.addComponent(partB, 'anatomy:part', {
      partType: 'extremity',
      subType: 'finger',
    });
    entityManager.addComponent(partB, 'core:name', { text: 'Detach Finger B' });

    await facade.attachPart(actorId, partA, ids.leftArmId, {
      notifyOnChange: false,
    });
    await facade.attachPart(actorId, partB, ids.leftArmId, {
      notifyOnChange: false,
    });

    const originalDetach = facade.detachPart.bind(facade);
    const detachSpy = jest.spyOn(facade, 'detachPart');
    detachSpy.mockImplementationOnce(async () => {
      throw new Error('forced detach failure');
    });
    detachSpy.mockImplementation(originalDetach);

    const progressSpy = jest.fn();
    const response = await facade.detachMultipleParts(actorId, [partA, partB], {
      notifyOnChange: false,
      batchSize: 1,
      parallel: true,
      returnResults: true,
      onProgress: progressSpy,
      stopOnError: false,
    });

    expect(response.success).toBe(true);
    expect(response.data.failed).toBe(1);
    expect(response.data.successful).toBe(1);
    expect(response.data.errors[0].error).toBe('forced detach failure');
    expect(response.partial).toBe(true);
    expect(progressSpy).toHaveBeenCalled();
  });

  it('stops bulk detachment immediately when stopOnError is enabled', async () => {
    const { facade, actorId, entityManager, ids } = context;

    const partId = 'bulk-stop-detach';
    entityManager.addComponent(partId, 'anatomy:part', {
      partType: 'extremity',
      subType: 'finger',
    });
    entityManager.addComponent(partId, 'core:name', {
      text: 'Stop Detach Finger',
    });

    await facade.attachPart(actorId, partId, ids.leftArmId, {
      notifyOnChange: false,
    });

    const originalDetach = facade.detachPart.bind(facade);
    const detachSpy = jest.spyOn(facade, 'detachPart');
    detachSpy.mockImplementationOnce(async () => {
      throw new Error('forced stop detach');
    });
    detachSpy.mockImplementation(originalDetach);

    const response = await facade.detachMultipleParts(actorId, [partId], {
      notifyOnChange: false,
      stopOnError: true,
    });

    expect(response.success).toBe(false);
    expect(response.error.message).toBe('forced stop detach');
  });
});
