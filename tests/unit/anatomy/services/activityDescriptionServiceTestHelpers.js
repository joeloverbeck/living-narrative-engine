/**
 * @file Test helpers for ActivityDescriptionService characterization tests
 * @description Provides factories, mocks, and utilities for comprehensive service testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest, expect } from '@jest/globals';

/**
 * Create a test service instance with configurable dependencies.
 *
 * @param {object} options - Service configuration options
 * @param {object} [options.logger] - Custom logger mock
 * @param {object} [options.entityManager] - Custom entity manager mock
 * @param {object} [options.anatomyFormattingService] - Custom formatting service mock
 * @param {object} [options.jsonLogicEvaluationService] - Custom JSON logic mock
 * @param {object} [options.cacheManager] - Custom cache manager mock
 * @param {object} [options.indexManager] - Custom index manager mock
 * @param {object} [options.metadataCollectionSystem] - Custom metadata collection system mock
 * @param {object} [options.groupingSystem] - Custom grouping system mock
 * @param {object} [options.nlgSystem] - Custom NLG system mock
 * @param {object} [options.activityIndex] - Custom activity index mock
 * @param {object} [options.eventBus] - Custom event bus mock
 * @returns {Promise<object>} Test service with mocks
 */
export async function createTestService(options = {}) {
  const mockLogger = options.logger || createMockLogger();
  const mockEntityManager = options.entityManager || createMockEntityManager();
  const mockAnatomyFormattingService = options.anatomyFormattingService || createMockAnatomyFormattingService();
  const mockJsonLogicEvaluationService = options.jsonLogicEvaluationService || createMockJsonLogic();
  const mockCacheManager = options.cacheManager || createMockCacheManager();
  const mockIndexManager = options.indexManager || createMockIndexManager();
  const mockActivityIndex = options.activityIndex || null;
  const mockMetadataCollectionSystem = options.metadataCollectionSystem || createMockMetadataCollectionSystem(mockActivityIndex, mockEntityManager);
  const mockGroupingSystem = options.groupingSystem || createMockGroupingSystem();
  const mockNLGSystem = options.nlgSystem || createMockNLGSystem(mockEntityManager);
  const mockEventBus = options.eventBus || createMockEventBus();

  // Lazy load ActivityDescriptionService to avoid import-time dependencies
  const { default: ActivityDescriptionService } = await import('../../../../src/anatomy/services/activityDescriptionService.js');

  const service = new ActivityDescriptionService({
    logger: mockLogger,
    entityManager: mockEntityManager,
    anatomyFormattingService: mockAnatomyFormattingService,
    jsonLogicEvaluationService: mockJsonLogicEvaluationService,
    cacheManager: mockCacheManager,
    indexManager: mockIndexManager,
    metadataCollectionSystem: mockMetadataCollectionSystem,
    groupingSystem: mockGroupingSystem,
    nlgSystem: mockNLGSystem,
    activityIndex: mockActivityIndex,
    eventBus: mockEventBus,
  });

  return {
    service,
    mockLogger,
    mockEntityManager,
    mockAnatomyFormattingService,
    mockJsonLogicEvaluationService,
    mockCacheManager,
    mockIndexManager,
    mockMetadataCollectionSystem,
    mockGroupingSystem,
    mockNLGSystem,
    mockEventBus,
    mockActivityIndex,
  };
}

/**
 * Create a standard entity with common components for testing.
 *
 * @param {object} [config] - Entity configuration
 * @param {string} [config.id] - Entity ID
 * @param {string} [config.name] - Entity name
 * @param {string} [config.gender] - Entity gender
 * @param {Map} [config.additionalComponents] - Additional components to add
 * @returns {object} Mock entity instance
 */
export function createStandardEntity(config = {}) {
  const {
    id = 'entity1',
    name = 'John',
    gender = 'male',
    additionalComponents = new Map(),
  } = config;

  const baseComponents = new Map([
    ['core:name', { text: name }],
    ['core:gender', { value: gender }],
  ]);

  // Merge additional components
  const allComponents = new Map([...baseComponents, ...additionalComponents]);

  return {
    id,
    componentTypeIds: Array.from(allComponents.keys()),
    getAllComponents: () => allComponents,
    getComponentData: function (componentId) {
      return this.getAllComponents().get(componentId);
    },
    hasComponent: function (componentId) {
      return this.getAllComponents().has(componentId);
    },
  };
}

/**
 * Create an entity with inline activity metadata.
 *
 * @param {object} config - Activity configuration
 * @param {string} config.componentId - Component ID with activity metadata
 * @param {object} config.activityMetadata - Activity metadata object
 * @param {string} [config.entityId] - Entity ID
 * @param {string} [config.name] - Entity name
 * @returns {object} Mock entity with activity metadata
 */
export function createEntityWithInlineMetadata(config) {
  const {
    componentId,
    activityMetadata,
    entityId = 'actor1',
    name = 'John',
  } = config;

  const additionalComponents = new Map([
    [componentId, {
      activityMetadata,
      entityId: 'target1', // Default target
    }],
  ]);

  return createStandardEntity({
    id: entityId,
    name,
    additionalComponents,
  });
}

/**
 * Create an entity with dedicated activity metadata component.
 *
 * @param {object} config - Metadata configuration
 * @param {string} config.sourceComponent - Source component ID
 * @param {string} [config.verb] - Activity verb
 * @param {string} [config.template] - Activity template
 * @param {number} [config.priority] - Activity priority
 * @param {string} [config.entityId] - Entity ID
 * @returns {object} Mock entity with dedicated metadata
 */
export function createEntityWithDedicatedMetadata(config) {
  const {
    sourceComponent,
    verb = 'touching',
    template,
    priority = 50,
    entityId = 'actor1',
    targetRole = 'entityId',
  } = config;

  const additionalComponents = new Map([
    ['activity:description_metadata', {
      sourceComponent,
      verb,
      template,
      priority,
      targetRole,
    }],
    [sourceComponent, {
      entityId: 'target1', // Default target
    }],
  ]);

  return createStandardEntity({
    id: entityId,
    additionalComponents,
  });
}

/**
 * Create a mock logger with all required methods.
 *
 * @returns {object} Mock logger
 */
export function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Create a mock entity manager.
 *
 * @param {Map} [entityMap] - Map of entity ID to entity instance
 * @returns {object} Mock entity manager
 */
export function createMockEntityManager(entityMap = new Map()) {
  return {
    getEntityInstance: jest.fn((entityId) => entityMap.get(entityId) || null),
  };
}

/**
 * Create a mock anatomy formatting service.
 *
 * @param {object} [config] - Activity integration configuration
 * @returns {object} Mock formatting service
 */
export function createMockAnatomyFormattingService(config = null) {
  const defaultConfig = {
    enabled: true,
    prefix: 'Activity: ',
    suffix: '.',
    separator: '. ',
    maxActivities: 10,
    enableContextAwareness: true,
    maxDescriptionLength: 500,
    deduplicateActivities: true,
    nameResolution: {
      usePronounsWhenAvailable: false,
      preferReflexivePronouns: true,
    },
  };

  return {
    getActivityIntegrationConfig: jest.fn(() => config || defaultConfig),
  };
}

/**
 * Create a mock JSON Logic evaluation service.
 *
 * @param {boolean} [defaultResult] - Default evaluation result
 * @returns {object} Mock JSON Logic service
 */
export function createMockJsonLogic(defaultResult = true) {
  return {
    evaluate: jest.fn(() => defaultResult),
  };
}

/**
 * Create a mock event bus.
 *
 * @returns {object} Mock event bus
 */
export function createMockEventBus() {
  const subscriptions = new Map();

  return {
    subscribe: jest.fn((eventType, handler) => {
      if (!subscriptions.has(eventType)) {
        subscriptions.set(eventType, []);
      }
      subscriptions.get(eventType).push(handler);

      // Return unsubscribe function
      return jest.fn(() => {
        const handlers = subscriptions.get(eventType);
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      });
    }),
    dispatch: jest.fn((event) => {
      const handlers = subscriptions.get(event.type) || [];
      handlers.forEach(handler => handler(event));
    }),
    unsubscribe: jest.fn(),
  };
}

/**
 * Create a mock activity index.
 *
 * @param {Array<object>} activities - Activities to index
 * @returns {object} Mock activity index
 */
export function createMockActivityIndex(activities = []) {
  return {
    findActivitiesForEntity: jest.fn(() => activities),
  };
}

/**
 * Load a golden master file from the goldenMasters directory.
 *
 * @param {string} filename - Golden master filename
 * @returns {object|string} Parsed golden master content
 */
export function loadGoldenMaster(filename) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(__dirname, 'goldenMasters', filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Golden master file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Parse JSON files, return text for .txt files
  if (filename.endsWith('.json')) {
    return JSON.parse(content);
  }

  return content;
}

/**
 * Load a fixture file from the fixtures directory.
 *
 * @param {string} filename - Fixture filename
 * @returns {object|string} Parsed fixture content
 */
export function loadFixture(filename) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(__dirname, 'fixtures', filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Fixture file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Parse JSON files, return text for .txt files
  if (filename.endsWith('.json')) {
    return JSON.parse(content);
  }

  return content;
}

/**
 * Create test activities with configurable properties.
 *
 * @param {Array<object>} configs - Activity configurations
 * @returns {Array<object>} Test activity objects
 */
export function createTestActivities(configs) {
  return configs.map(config => ({
    type: config.type || 'inline',
    sourceComponent: config.sourceComponent || 'test:component',
    targetEntityId: config.targetEntityId || null,
    targetId: config.targetId || config.targetEntityId || null,
    priority: config.priority !== undefined ? config.priority : 50,
    template: config.template || '{actor} interacts with {target}',
    verb: config.verb || 'interacting with',
    adverb: config.adverb || null,
    description: config.description || null,
    conditions: config.conditions || null,
    grouping: config.grouping || null,
    activityMetadata: config.activityMetadata || {},
    sourceData: config.sourceData || {},
  }));
}

/**
 * Create a test activity group.
 *
 * @param {object} primaryActivity - Primary activity
 * @param {Array<object>} relatedActivities - Related activities with conjunctions
 * @returns {object} Activity group
 */
export function createTestActivityGroup(primaryActivity, relatedActivities = []) {
  return {
    primaryActivity,
    relatedActivities: relatedActivities.map(related => ({
      activity: related.activity,
      conjunction: related.conjunction || 'and',
    })),
  };
}

/**
 * Assert that an activity description matches expected output.
 *
 * @param {string} actual - Actual description
 * @param {string} expected - Expected description
 * @param {object} [options] - Assertion options
 */
export function assertDescriptionMatches(actual, expected, options = {}) {
  const { ignoreWhitespace = false } = options;

  if (ignoreWhitespace) {
    const normalizeWhitespace = (str) => str.replace(/\s+/g, ' ').trim();
    expect(normalizeWhitespace(actual)).toBe(normalizeWhitespace(expected));
  } else {
    expect(actual).toBe(expected);
  }
}

/**
 * Create a comprehensive test scenario with multiple entities and activities.
 *
 * @param {object} config - Scenario configuration
 * @returns {object} Test scenario with entities and activities
 */
export function createTestScenario(config = {}) {
  const {
    actorId = 'actor1',
    actorName = 'John',
    actorGender = 'male',
    targetId = 'target1',
    targetName = 'Alice',
    targetGender = 'female',
    activities = [],
  } = config;

  const actor = createStandardEntity({
    id: actorId,
    name: actorName,
    gender: actorGender,
  });

  const target = createStandardEntity({
    id: targetId,
    name: targetName,
    gender: targetGender,
  });

  const entityMap = new Map([
    [actorId, actor],
    [targetId, target],
  ]);

  return {
    actor,
    target,
    entities: entityMap,
    activities: activities.length > 0 ? activities : createTestActivities([
      { targetEntityId: targetId, priority: 50 },
    ]),
  };
}

/**
 * Create a mock cache manager.
 *
 * @returns {object} Mock cache manager
 */
export function createMockCacheManager() {
  const caches = new Map();

  return {
    registerCache: jest.fn((cacheName, _config) => {
      caches.set(cacheName, new Map());
    }),
    get: jest.fn((cacheName, key) => {
      const cache = caches.get(cacheName);
      return cache ? cache.get(key) : undefined;
    }),
    set: jest.fn((cacheName, key, value) => {
      if (!caches.has(cacheName)) {
        caches.set(cacheName, new Map());
      }
      caches.get(cacheName).set(key, value);
    }),
    invalidate: jest.fn((cacheName, key) => {
      const cache = caches.get(cacheName);
      if (cache) cache.delete(key);
    }),
    clear: jest.fn((cacheName) => {
      const cache = caches.get(cacheName);
      if (cache) cache.clear();
    }),
    clearAll: jest.fn(() => {
      caches.clear();
    }),
    destroy: jest.fn(() => {
      caches.clear();
    }),
  };
}

/**
 * Create a mock index manager.
 *
 * @returns {object} Mock index manager
 */
export function createMockIndexManager() {
  return {
    buildIndex: jest.fn((activities, _cacheKey) => ({
      byPriority: [...activities].sort((a, b) => (b.priority || 0) - (a.priority || 0)),
      byTarget: new Map(),
      byGroupKey: new Map(),
      all: activities,
    })),
  };
}

/**
 * Create a mock metadata collection system that actually collects from entities.
 *
 * @param {object} [activityIndex] - Optional activity index to use
 * @param {object} [entityManager] - Optional entity manager for real collection
 * @returns {object} Mock metadata collection system
 */
export function createMockMetadataCollectionSystem(activityIndex = null, entityManager = null) {
  const collectActivitiesFromEntity = (entityId, entity) => {
    const activities = [];

    // If activityIndex is provided, use it first
    if (activityIndex && typeof activityIndex.findActivitiesForEntity === 'function') {
      try {
        const indexResult = activityIndex.findActivitiesForEntity(entityId);
        // Validate result is an array
        if (Array.isArray(indexResult)) {
          return indexResult;
        }
        // Invalid data type - fall through to component collection
      } catch {
        // Error thrown - fall through to component collection
      }
    }

    // Otherwise, collect from entity components if entity manager is provided
    if (entityManager && entity) {
      const components = entity.getAllComponents();

      for (const [componentId, componentData] of components) {
        // Collect inline metadata
        if (componentData && componentData.activityMetadata) {
          const metadata = componentData.activityMetadata;
          if (metadata.shouldDescribeInActivity !== false) {
            activities.push({
              type: 'inline',
              sourceComponent: componentId,
              targetEntityId: componentData.targetId || componentData.entityId || null,
              targetId: componentData.targetId || componentData.entityId || null,
              priority: metadata.priority || 50,
              template: metadata.template || '',
              verb: metadata.verb || '',
              adverb: metadata.adverb || null,
              description: metadata.description || null,
              conditions: metadata.conditions || null,
              grouping: metadata.grouping || null,
              activityMetadata: metadata,
              sourceData: componentData,
            });
          }
        }
      }

      // Check for dedicated metadata components
      if (components.has('activity:description_metadata')) {
        const dedicatedMetadata = components.get('activity:description_metadata');
        if (dedicatedMetadata && dedicatedMetadata.sourceComponent) {
          const sourceData = components.get(dedicatedMetadata.sourceComponent);
          activities.push({
            type: 'dedicated',
            sourceComponent: dedicatedMetadata.sourceComponent,
            targetEntityId: sourceData?.targetId || sourceData?.entityId || null,
            targetId: sourceData?.targetId || sourceData?.entityId || null,
            priority: dedicatedMetadata.priority || 50,
            template: dedicatedMetadata.template || '',
            verb: dedicatedMetadata.verb || '',
            adverb: dedicatedMetadata.adverb || null,
            description: dedicatedMetadata.description || null,
            conditions: dedicatedMetadata.conditions || null,
            grouping: dedicatedMetadata.grouping || null,
            activityMetadata: dedicatedMetadata,
            sourceData: sourceData || {},
          });
        }
      }
    }

    return activities;
  };

  // Helper to collect inline metadata from an entity
  const collectInlineFromEntity = (entity) => {
    if (!entity || !entity.getAllComponents) return [];

    const activities = [];
    const components = entity.getAllComponents();

    for (const [componentId, componentData] of components) {
      // Skip dedicated metadata components during inline scanning
      if (componentId === 'activity:description_metadata') continue;

      if (componentData && componentData.activityMetadata) {
        const metadata = componentData.activityMetadata;

        // Validate metadata is an object
        if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
          continue; // Skip malformed metadata
        }

        // Skip if explicitly disabled
        if (metadata.shouldDescribeInActivity === false) continue;

        // Validate required template field
        if (!metadata.template || typeof metadata.template !== 'string' || metadata.template.trim() === '') {
          continue; // Skip metadata without valid template
        }

        // Normalize blank target references to null
        const normalizeTarget = (val) => {
          if (typeof val === 'string' && val.trim() === '') return null;
          return val || null;
        };

        activities.push({
          type: 'inline',
          sourceComponent: componentId,
          targetEntityId: normalizeTarget(componentData.targetId || componentData.entityId),
          targetId: normalizeTarget(componentData.targetId || componentData.entityId),
          priority: metadata.priority || 50,
          template: metadata.template,
          verb: metadata.verb || '',
          adverb: metadata.adverb || null,
          description: metadata.description || null,
          conditions: metadata.conditions || null,
          grouping: metadata.grouping || null,
          activityMetadata: metadata,
          sourceData: componentData,
        });
      }
    }

    return activities;
  };

  // Helper to collect dedicated metadata from an entity
  const collectDedicatedFromEntity = (entity) => {
    if (!entity || !entity.getAllComponents) return [];

    const activities = [];
    const components = entity.getAllComponents();

    if (components.has('activity:description_metadata')) {
      const dedicatedMetadata = components.get('activity:description_metadata');
      if (dedicatedMetadata && dedicatedMetadata.sourceComponent) {
        const sourceData = components.get(dedicatedMetadata.sourceComponent);
        activities.push({
          type: 'dedicated',
          sourceComponent: dedicatedMetadata.sourceComponent,
          targetEntityId: sourceData?.targetId || sourceData?.entityId || null,
          targetId: sourceData?.targetId || sourceData?.entityId || null,
          priority: dedicatedMetadata.priority || 50,
          template: dedicatedMetadata.template || '',
          verb: dedicatedMetadata.verb || '',
          adverb: dedicatedMetadata.adverb || null,
          description: dedicatedMetadata.description || null,
          conditions: dedicatedMetadata.conditions || null,
          grouping: dedicatedMetadata.grouping || null,
          activityMetadata: dedicatedMetadata,
          sourceData: sourceData || {},
        });
      }
    }

    return activities;
  };

  return {
    collectActivityMetadata: jest.fn((entityId, entity) => {
      return collectActivitiesFromEntity(entityId, entity);
    }),
    collectInlineMetadata: jest.fn((entity) => {
      return collectInlineFromEntity(entity);
    }),
    collectDedicatedMetadata: jest.fn((entity) => {
      return collectDedicatedFromEntity(entity);
    }),
    collectActivities: jest.fn(() => []),
    deduplicateActivitiesBySignature: jest.fn((activities) => activities),
    buildActivityDeduplicationKey: jest.fn((activity) => JSON.stringify(activity)),
    getTestHooks: jest.fn(() => ({
      collectActivities: jest.fn(() => []),
      deduplicateActivitiesBySignature: jest.fn((activities) => activities),
      buildActivityDeduplicationKey: jest.fn((activity) => JSON.stringify(activity)),
      parseInlineMetadata: jest.fn(() => ({})),
      parseDedicatedMetadata: jest.fn(() => ({})),
    })),
  };
}

/**
 * Create a mock grouping system.
 *
 * @returns {object} Mock grouping system
 */
export function createMockGroupingSystem() {
  const SIMULTANEOUS_PRIORITY_THRESHOLD = 10;

  const shouldGroupActivities = (first, second) => {
    const firstGroupKey = first?.grouping?.groupKey;
    const secondGroupKey = second?.grouping?.groupKey;
    if (firstGroupKey && firstGroupKey === secondGroupKey) {
      return true;
    }
    const firstTarget = first?.targetEntityId ?? first?.targetId;
    const secondTarget = second?.targetEntityId ?? second?.targetId;
    if (firstTarget && firstTarget === secondTarget) {
      return true;
    }
    return false;
  };

  const determineConjunction = (first, second) => {
    const firstPriority = first?.priority ?? 0;
    const secondPriority = second?.priority ?? 0;
    const priorityDiff = Math.abs(firstPriority - secondPriority);
    return priorityDiff <= SIMULTANEOUS_PRIORITY_THRESHOLD ? 'while' : 'and';
  };

  return {
    groupActivities: jest.fn((activities, _cacheKey) => {
      if (!Array.isArray(activities) || activities.length === 0) {
        return [];
      }

      // Sort by priority (highest first)
      const prioritized = [...activities].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      const groups = [];
      const visited = new Set();

      for (let i = 0; i < prioritized.length; i += 1) {
        const activity = prioritized[i];
        if (visited.has(activity)) {
          continue;
        }

        const group = {
          primaryActivity: activity,
          relatedActivities: [],
        };
        visited.add(activity);

        // Look for activities to group with this one
        for (let j = i + 1; j < prioritized.length; j += 1) {
          const candidate = prioritized[j];
          if (visited.has(candidate)) {
            continue;
          }

          if (shouldGroupActivities(activity, candidate)) {
            group.relatedActivities.push({
              activity: candidate,
              conjunction: determineConjunction(activity, candidate),
            });
            visited.add(candidate);
          }
        }

        groups.push(group);
      }

      return groups;
    }),
    sortByPriority: jest.fn((activities, _cacheKey) => {
      return [...activities].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }),
    getTestHooks: jest.fn(() => ({
      groupActivities: jest.fn((_activities, _cacheKey) => []),
      sortByPriority: jest.fn((activities, _cacheKey) => activities),
      startActivityGroup: jest.fn((activity) => ({
        primaryActivity: activity,
        relatedActivities: [],
      })),
      shouldGroupActivities: jest.fn((first, second) => shouldGroupActivities(first, second)),
      determineConjunction: jest.fn((first, second) => determineConjunction(first, second)),
      activitiesOccurSimultaneously: jest.fn((p1, p2) => Math.abs(p1 - p2) <= SIMULTANEOUS_PRIORITY_THRESHOLD),
    })),
  };
}

/**
 * Create a mock NLG system that matches real behavior.
 *
 * @param {object} [entityManager] - Optional entity manager for real gender detection
 * @returns {object} Mock NLG system
 */
export function createMockNLGSystem(entityManager = null) {
  // Pronoun sets matching real NLGSystem behavior
  const pronounSets = {
    male: { subject: 'he', object: 'him', possessive: 'his', possessivePronoun: 'his' },
    female: { subject: 'she', object: 'her', possessive: 'her', possessivePronoun: 'hers' },
    neutral: { subject: 'they', object: 'them', possessive: 'their', possessivePronoun: 'theirs' },
    futa: { subject: 'she', object: 'her', possessive: 'her', possessivePronoun: 'hers' },
  };

  // Gender detection matching real NLGSystem behavior
  const detectGender = (entityId) => {
    if (!entityManager) return 'neutral';

    const entity = entityManager.getEntityInstance(entityId);
    if (!entity) return 'neutral';

    const genderComponent = entity.getComponentData?.('core:gender');
    if (genderComponent?.value) {
      return genderComponent.value;
    }

    return 'neutral';
  };

  // Name resolution matching real NLGSystem behavior
  const resolveName = (entityId) => {
    if (!entityManager) return entityId;

    const entity = entityManager.getEntityInstance(entityId);
    if (!entity) return entityId;

    const nameComponent = entity.getComponentData?.('core:name');
    if (nameComponent?.text) {
      return nameComponent.text;
    }

    return entityId; // Fallback to entityId like production code
  };

  return {
    formatActivityDescription: jest.fn((_groups, _config, _entity) => 'formatted description'),
    mergeAdverb: jest.fn((currentAdverb, injected) => {
      const normalizedInjected = typeof injected === 'string' ? injected.trim() : '';
      const normalizedCurrent = typeof currentAdverb === 'string' ? currentAdverb.trim() : '';

      if (!normalizedInjected) {
        return normalizedCurrent;
      }

      if (!normalizedCurrent) {
        return normalizedInjected;
      }

      const lowerCurrent = normalizedCurrent.toLowerCase();
      if (lowerCurrent.includes(normalizedInjected.toLowerCase())) {
        return normalizedCurrent;
      }

      return `${normalizedCurrent} ${normalizedInjected}`.trim();
    }),
    injectSoftener: jest.fn((template, descriptor) => {
      if (!descriptor || typeof template !== 'string') {
        return template;
      }

      // Handle both string descriptor and object with adverb property
      let trimmedDescriptor;
      if (typeof descriptor === 'object' && descriptor.adverb) {
        trimmedDescriptor = descriptor.adverb.trim();
      } else if (typeof descriptor === 'string') {
        trimmedDescriptor = descriptor.trim();
      } else {
        return template;
      }

      if (!trimmedDescriptor) {
        return template;
      }

      if (!template.includes('{target}')) {
        return template;
      }

      const existingDescriptor = `${trimmedDescriptor} {target}`.toLowerCase();
      if (template.toLowerCase().includes(existingDescriptor)) {
        return template;
      }

      return template.replace('{target}', `${trimmedDescriptor} {target}`);
    }),
    sanitizeVerbPhrase: jest.fn((phrase) => phrase),
    buildRelatedActivityFragment: jest.fn((conjunction, components, _context) =>
      `${conjunction} ${components.verbPhrase}`
    ),
    truncateDescription: jest.fn((description, _maxLength) => description),
    sanitizeEntityName: jest.fn((name) => name),
    resolveEntityName: jest.fn((entityId) => resolveName(entityId)),
    shouldUsePronounForTarget: jest.fn((_targetId) => false),
    detectEntityGender: jest.fn((entityId) => detectGender(entityId)),
    getPronounSet: jest.fn((gender) => pronounSets[gender] || pronounSets.neutral),
    getReflexivePronoun: jest.fn((pronouns) => {
      const subject = pronouns?.subject?.toLowerCase?.() ?? '';

      switch (subject) {
        case 'he':
          return 'himself';
        case 'she':
          return 'herself';
        case 'it':
          return 'itself';
        case 'i':
          return 'myself';
        case 'you':
          return 'yourself';
        case 'we':
          return 'ourselves';
        default:
          return 'themselves';
      }
    }),
    generateActivityPhrase: jest.fn((actorRef, activity, _usePronounsForTarget = false, _options = {}) => {
      // Process templates to match real NLGSystem behavior
      if (!activity) return '';

      const targetEntityId = activity.targetEntityId || activity.targetId;
      let targetRef = '';
      if (targetEntityId && entityManager) {
        targetRef = resolveName(targetEntityId);
      }

      // Check if template property exists (even if empty string)
      if ('template' in activity) {
        return (activity.template || '')
          .replace(/\{actor\}/g, actorRef)
          .replace(/\{target\}/g, targetRef);
      }

      if (activity.description) {
        return targetRef
          ? `${actorRef} ${activity.description} ${targetRef}`
          : `${actorRef} ${activity.description}`;
      }

      if (activity.verb) {
        return targetRef
          ? `${actorRef} ${activity.verb} ${targetRef}`
          : `${actorRef} ${activity.verb}`;
      }

      return 'activity phrase';
    }),
  };
}
