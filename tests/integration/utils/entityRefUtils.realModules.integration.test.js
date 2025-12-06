import { describe, it, expect, beforeEach } from '@jest/globals';
import { createNestedExecutionContext } from '../../../src/logic/contextAssembler.js';
import {
  placeholderMetrics,
  resolveEntityId,
  resolvePlaceholdersBatch,
  validatePlaceholders,
} from '../../../src/utils/entityRefUtils.js';
import { validateEntityRef } from '../../../src/utils/operationValidationUtils.js';
import {
  ACTOR_ROLE,
  PRIMARY_ROLE,
  SECONDARY_ROLE,
  TERTIARY_ROLE,
  LEGACY_TARGET_ROLE,
} from '../../../src/actions/pipeline/TargetRoleRegistry.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, metadata) {
    this.debugEntries.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoEntries.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnEntries.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorEntries.push({ message, metadata });
  }
}

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
    return true;
  }
}

class TestEntityManager {
  constructor(entityDefinitions) {
    this.entities = entityDefinitions;
  }

  getEntityInstance(id) {
    const entity = this.entities[id];
    return entity ? { id, ...entity } : null;
  }

  getAllComponentTypesForEntity(id) {
    const entity = this.entities[id];
    if (!entity || !entity.components) {
      return [];
    }
    return Object.keys(entity.components);
  }

  getComponentData(id, componentType) {
    const entity = this.entities[id];
    if (!entity || !entity.components) {
      throw new Error(`Unknown entity: ${id}`);
    }
    return entity.components[componentType];
  }

  hasComponent(id, componentType) {
    const entity = this.entities[id];
    if (!entity || !entity.components) {
      throw new Error(`Unknown entity: ${id}`);
    }
    return Object.prototype.hasOwnProperty.call(
      entity.components,
      componentType
    );
  }
}

describe('entityRefUtils integration with real execution context', () => {
  let logger;
  let entityManager;
  let baseEvent;

  beforeEach(() => {
    logger = new RecordingLogger();
    placeholderMetrics.reset();

    entityManager = new TestEntityManager({
      'entity:actor': {
        components: {
          identity: { displayName: 'Hero' },
          location: { id: 'location:atrium' },
        },
      },
      'entity:target': {
        components: {
          identity: { displayName: 'Rival' },
        },
      },
      'entity:primary': {
        components: {
          identity: { displayName: 'Primary Ally' },
        },
      },
      'entity:secondary': {
        components: {
          identity: { displayName: 'Backup Ally' },
        },
      },
      'entity:legacy-primary': {
        components: {
          identity: { displayName: 'Legacy Primary' },
        },
      },
    });

    baseEvent = {
      type: 'core:test_event',
      payload: {
        actorId: 'entity:actor',
        targetId: 'entity:target',
        actionId: 'core:integration-test',
        targets: {
          primary: { entityId: 'entity:primary' },
          secondary: 'entity:secondary',
        },
        primaryId: 'entity:legacy-primary',
      },
    };
  });

  /**
   *
   * @param customPayload
   */
  function createExecutionContext(customPayload = baseEvent.payload) {
    const event = { ...baseEvent, payload: { ...customPayload } };
    return createNestedExecutionContext(
      event,
      event.payload.actorId,
      event.payload.targetId,
      entityManager,
      logger,
      null
    );
  }

  it('resolves actor, target, and placeholder references using structured payloads', () => {
    const executionContext = createExecutionContext();

    const resolvedActor = resolveEntityId(ACTOR_ROLE, executionContext);
    const resolvedTarget = resolveEntityId(
      LEGACY_TARGET_ROLE,
      executionContext
    );
    const resolvedPrimary = resolveEntityId(PRIMARY_ROLE, executionContext);
    const resolvedSecondary = resolveEntityId(SECONDARY_ROLE, executionContext);

    expect(resolvedActor).toBe('entity:actor');
    expect(resolvedTarget).toBe('entity:target');
    expect(resolvedPrimary).toBe('entity:primary');
    expect(resolvedSecondary).toBe('entity:secondary');

    // Fallback to legacy primaryId when comprehensive target data is removed.
    const payloadWithoutPrimaryTarget = {
      ...baseEvent.payload,
      targets: { secondary: 'entity:secondary' },
    };
    const ctxWithLegacy = createExecutionContext(payloadWithoutPrimaryTarget);
    const legacyResolved = resolveEntityId(PRIMARY_ROLE, ctxWithLegacy);
    expect(legacyResolved).toBe('entity:legacy-primary');

    // Direct string trimming and object entityRef support
    expect(resolveEntityId('  entity:secondary  ', executionContext)).toBe(
      'entity:secondary'
    );
    expect(
      resolveEntityId({ entityId: ' entity:primary ' }, executionContext)
    ).toBe('entity:primary');

    // Unresolvable placeholder logs a warning and returns null
    const missing = resolveEntityId(TERTIARY_ROLE, executionContext);
    expect(missing).toBeNull();
    expect(
      logger.warnEntries.some((entry) =>
        entry.message.includes(
          "Failed to resolve placeholder 'tertiary' - no matching target in event payload"
        )
      )
    ).toBe(true);

    const metrics = placeholderMetrics.getMetrics();
    expect(metrics.total).toBeGreaterThanOrEqual(4);
    expect(metrics.success).toBeGreaterThanOrEqual(3);
    expect(metrics.failure).toBeGreaterThanOrEqual(1);
  });

  it('validates placeholder arrays and exposes available targets across formats', () => {
    const payload = {
      ...baseEvent.payload,
      secondaryId: 'entity:secondary',
      targets: {
        ...baseEvent.payload.targets,
        tertiary: {},
      },
    };

    const result = validatePlaceholders(
      [PRIMARY_ROLE, SECONDARY_ROLE, TERTIARY_ROLE],
      payload
    );

    expect(result.valid).toBe(false);
    expect(result.resolved).toEqual([PRIMARY_ROLE, SECONDARY_ROLE]);
    expect(result.missing).toEqual([TERTIARY_ROLE]);
    expect(result.available).toEqual(
      expect.arrayContaining([
        PRIMARY_ROLE,
        SECONDARY_ROLE,
        TERTIARY_ROLE,
        LEGACY_TARGET_ROLE,
      ])
    );
    expect(result.errors[0]).toMatchObject({
      placeholder: TERTIARY_ROLE,
      errorType: 'PLACEHOLDER_NOT_RESOLVED',
    });

    const nonArrayResult = validatePlaceholders('not-an-array', payload);
    expect(nonArrayResult.valid).toBe(false);
    expect(nonArrayResult.errors[0].errorType).toBe('INVALID_INPUT');
  });

  it('resolves batches and integrates with operation validation utilities', () => {
    const executionContext = createExecutionContext();
    const dispatcher = new RecordingDispatcher();

    const batch = resolvePlaceholdersBatch(
      [PRIMARY_ROLE, SECONDARY_ROLE, TERTIARY_ROLE],
      baseEvent.payload
    );
    expect(batch.get(PRIMARY_ROLE)).toBe('entity:primary');
    expect(batch.get(SECONDARY_ROLE)).toBe('entity:secondary');
    expect(batch.get(TERTIARY_ROLE)).toBeNull();

    const resolved = validateEntityRef(
      PRIMARY_ROLE,
      executionContext,
      logger,
      dispatcher,
      'ComponentOperation'
    );
    expect(resolved).toBe('entity:primary');

    const missing = validateEntityRef(
      TERTIARY_ROLE,
      executionContext,
      logger,
      dispatcher,
      'ComponentOperation'
    );
    expect(missing).toBeNull();
    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0]).toMatchObject({
      eventId: SYSTEM_ERROR_OCCURRED_ID,
    });
    expect(dispatcher.events[0].payload.message).toContain(
      'ComponentOperation: Could not resolve entity id'
    );
  });

  it('tracks metrics when resolving against missing payloads', () => {
    const emptyResults = resolvePlaceholdersBatch([PRIMARY_ROLE], null);
    expect(emptyResults.get(PRIMARY_ROLE)).toBeNull();

    const metrics = placeholderMetrics.getMetrics();
    expect(metrics.total).toBeGreaterThan(0);
    expect(metrics.failure).toBe(metrics.total);
  });
});
