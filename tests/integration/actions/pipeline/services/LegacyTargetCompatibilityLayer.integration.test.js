import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import { LegacyTargetCompatibilityLayer } from '../../../../../src/actions/pipeline/services/implementations/LegacyTargetCompatibilityLayer.js';
import { createMultiTargetResolutionStage } from '../../../../common/actions/multiTargetStageTestUtilities.js';
import { EntityManagerTestBed } from '../../../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../../../src/entities/entityDefinition.js';
import { ActionResult } from '../../../../../src/actions/core/actionResult.js';

/**
 * Minimal resolver that walks the entity graph to satisfy scope lookups without mocks.
 */
class IntegrationScopeResolver {
  /**
   * @param {import('../../../../../src/interfaces/coreServices.js').IEntityManager} entityManager
   */
  constructor(entityManager) {
    this.entityManager = entityManager;
  }

  /**
   * Resolve a scope into entity ids using live entity data.
   *
   * @param {string} scope
   * @param {object} context
   * @returns {Promise<ActionResult>}
   */
  async resolve(scope, context) {
    const actorId = context?.actor?.id;
    if (!actorId) {
      return ActionResult.failure({
        message: 'Missing actor for scope resolution',
      });
    }

    const ids = this.#collectIds(scope, actorId);
    if (ids === null) {
      return ActionResult.failure({
        message: `Unsupported scope: ${scope}`,
        scope,
      });
    }

    return ActionResult.success(new Set(ids));
  }

  /**
   * @param {string} scope
   * @param {string} actorId
   * @returns {string[] | null}
   */
  #collectIds(scope, actorId) {
    const entityManager = this.entityManager;
    const getComponent = (entityId, componentId) =>
      entityManager.getComponentData(entityId, componentId) || {};

    if (scope === 'self' || scope === 'actor') {
      return [actorId];
    }

    if (scope === 'none') {
      return [];
    }

    if (scope === 'actor.location') {
      const position = getComponent(actorId, 'core:position');
      return position?.locationId ? [position.locationId] : [];
    }

    if (scope === 'actor.inventory.items[]' || scope === 'actor.items') {
      const inventory = getComponent(actorId, 'core:inventory');
      return Array.isArray(inventory.items) ? inventory.items : [];
    }

    if (scope === 'actor.partners') {
      const relationships = getComponent(actorId, 'relationships:partners');
      return Array.isArray(relationships.ids) ? relationships.ids : [];
    }

    return null;
  }
}

/**
 * Resolves legacy scopes by returning lightweight context objects.
 */
class IntegrationTargetResolver {
  /**
   * @param {import('../../../../../src/interfaces/coreServices.js').IEntityManager} entityManager
   */
  constructor(entityManager) {
    this.entityManager = entityManager;
  }

  /**
   * @param {string} scope
   * @param {import('../../../../../src/entities/entity.js').default} actor
   * @returns {Promise<{success: boolean, value?: Array<object>, errors?: Array<object>}>}
   */
  async resolveTargets(scope, actor) {
    const actorId = actor?.id;
    if (!actorId) {
      return {
        success: false,
        errors: [{ message: 'Actor is required for legacy resolution' }],
      };
    }

    const ids = this.#collectIds(scope, actorId);
    if (ids === null) {
      return {
        success: false,
        errors: [{ message: `Unsupported legacy scope: ${scope}` }],
      };
    }

    const value = ids.map((entityId) => this.#buildContext(entityId));
    return { success: true, value };
  }

  /**
   * @param {string} scope
   * @param {string} actorId
   * @returns {string[] | null}
   */
  #collectIds(scope, actorId) {
    const entityManager = this.entityManager;
    const getComponent = (entityId, componentId) =>
      entityManager.getComponentData(entityId, componentId) || {};

    if (scope === 'self' || scope === 'actor') {
      return [actorId];
    }

    if (scope === 'none') {
      return [];
    }

    if (scope === 'actor.location') {
      const position = getComponent(actorId, 'core:position');
      return position?.locationId ? [position.locationId] : [];
    }

    if (scope === 'actor.inventory.items[]' || scope === 'actor.items') {
      const inventory = getComponent(actorId, 'core:inventory');
      return Array.isArray(inventory.items) ? inventory.items : [];
    }

    if (scope === 'actor.partners') {
      const relationships = getComponent(actorId, 'relationships:partners');
      return Array.isArray(relationships.ids) ? relationships.ids : [];
    }

    return null;
  }

  /**
   * @param {string} entityId
   * @returns {{entityId: string, displayName: string}}
   */
  #buildContext(entityId) {
    const entity = this.entityManager.getEntityInstance(entityId);
    const nameComponent = entity
      ? this.entityManager.getComponentData(entity.id, 'core:name')
      : null;
    return {
      entityId,
      displayName: nameComponent?.text || entityId,
    };
  }
}

describe('LegacyTargetCompatibilityLayer integration', () => {
  let logger;
  let entityTestBed;
  let entityManager;
  let legacyLayer;
  let stage;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    entityTestBed = new EntityManagerTestBed();
    entityManager = entityTestBed.entityManager;
    legacyLayer = new LegacyTargetCompatibilityLayer({ logger });

    stage = createMultiTargetResolutionStage({
      entityManager,
      logger,
      unifiedScopeResolver: new IntegrationScopeResolver(entityManager),
      targetResolver: new IntegrationTargetResolver(entityManager),
      overrides: { legacyTargetCompatibilityLayer: legacyLayer },
    });
  });

  afterEach(async () => {
    await entityTestBed.cleanup();
    jest.clearAllMocks();
  });

  it('converts string legacy targets and cooperates with the resolution stage', async () => {
    const locationDef = new EntityDefinition('test:location', {
      description: 'Test location',
      components: {
        'core:name': { text: 'Courtyard' },
      },
    });

    const actorDef = new EntityDefinition('test:actor', {
      description: 'Legacy actor',
      components: {
        'core:actor': {},
        'core:name': { text: 'Hero' },
        'core:position': { locationId: 'location-001' },
      },
    });

    const anotherDef = new EntityDefinition('test:actor-template', {
      description: 'Secondary actor template',
      components: {
        'core:actor': {},
        'core:name': { text: 'Template Hero' },
        'core:position': { locationId: 'location-001' },
      },
    });

    entityTestBed.setupDefinitions(locationDef, actorDef, anotherDef);
    await entityManager.createEntityInstance('test:location', {
      instanceId: 'location-001',
    });
    const actor = await entityManager.createEntityInstance('test:actor', {
      instanceId: 'actor-001',
    });
    await entityManager.createEntityInstance('test:actor-template', {
      instanceId: 'actor-002',
    });

    const actionWithExplicitPlaceholder = {
      id: 'legacy:self-check',
      name: 'Inspect Self',
      template: 'inspect {self}',
      targets: 'self',
      placeholder: 'selfEntity',
      targetDescription: 'Self inspection target',
    };

    const actionWithTemplatePlaceholder = {
      id: 'legacy:self-check-template',
      name: 'Inspect Template Self',
      template: 'inspect {self}',
      targets: 'self',
    };

    const context = {
      candidateActions: [
        actionWithExplicitPlaceholder,
        actionWithTemplatePlaceholder,
      ],
      actor,
      actionContext: { actor },
      data: {},
    };

    const result = await stage.executeInternal(context);
    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(2);

    const [explicit, template] = result.data.actionsWithTargets;

    expect(explicit.targetDefinitions.primary).toEqual(
      expect.objectContaining({
        scope: 'self',
        placeholder: 'selfEntity',
        description: 'Self inspection target',
      })
    );
    expect(explicit.targetContexts[0]).toEqual(
      expect.objectContaining({ entityId: 'actor-001', displayName: 'Hero' })
    );

    expect(template.targetDefinitions.primary).toEqual(
      expect.objectContaining({ scope: 'self', placeholder: 'self' })
    );
    expect(template.targetContexts[0]).toEqual(
      expect.objectContaining({ entityId: 'actor-001', displayName: 'Hero' })
    );

    // The layer should recognise both actions as legacy and validate the conversion.
    expect(legacyLayer.isLegacyAction(actionWithExplicitPlaceholder)).toBe(
      true
    );
    expect(legacyLayer.isLegacyAction(actionWithTemplatePlaceholder)).toBe(
      true
    );
    expect(legacyLayer.isLegacyAction(null)).toBe(false);

    const conversion = legacyLayer.convertLegacyFormat(
      actionWithExplicitPlaceholder,
      actor
    );
    expect(conversion.error).toBeUndefined();
    const validation = legacyLayer.validateConversion(
      actionWithExplicitPlaceholder,
      conversion.targetDefinitions
    );
    expect(validation.valid).toBe(true);

    const errorAction = {
      id: 'legacy:error',
      name: 'Explode',
      targets: 'self',
    };
    Object.defineProperty(errorAction, 'placeholder', {
      get() {
        throw new Error('placeholder failure');
      },
    });
    const errorConversion = legacyLayer.convertLegacyFormat(errorAction, actor);
    expect(errorConversion.isLegacy).toBe(true);
    expect(errorConversion.error).toContain('Failed to convert legacy format');

    const countOnlyAction = {
      id: 'legacy:count-only',
      name: 'Legacy Count Only',
      targetCount: 1,
    };
    expect(legacyLayer.isLegacyAction(countOnlyAction)).toBe(true);
    const countConversion = legacyLayer.convertLegacyFormat(
      countOnlyAction,
      actor
    );
    expect(countConversion.targetDefinitions.primary.scope).toBe('none');

    const itemAction = {
      id: 'legacy:item',
      name: 'Item Scope',
      targets: 'actor.items',
    };
    const itemConversion = legacyLayer.convertLegacyFormat(itemAction, actor);
    expect(itemConversion.targetDefinitions.primary.placeholder).toBe('item');

    const locationAction = {
      id: 'legacy:location',
      name: 'Location Scope',
      targets: 'actor.location',
    };
    const locationConversion = legacyLayer.convertLegacyFormat(
      locationAction,
      actor
    );
    expect(locationConversion.targetDefinitions.primary.placeholder).toBe(
      'location'
    );

    const actorTargetAction = {
      id: 'legacy:actor',
      name: 'Actor Scope',
      targetType: 'actor',
    };
    const actorTargetConversion = legacyLayer.convertLegacyFormat(
      actorTargetAction,
      actor
    );
    expect(actorTargetConversion.targetDefinitions.primary.placeholder).toBe(
      'actor'
    );

    const unknownTypeAction = {
      id: 'legacy:unknown-type',
      name: 'Unknown Type',
      targetType: 'mystery',
    };
    const unknownTypeConversion = legacyLayer.convertLegacyFormat(
      unknownTypeAction,
      actor
    );
    expect(unknownTypeConversion.targetDefinitions.primary.scope).toBe('none');

    const selfTypeAction = {
      id: 'legacy:self-type',
      name: 'Self Type',
      targetType: 'self',
    };
    const selfTypeConversion = legacyLayer.convertLegacyFormat(
      selfTypeAction,
      actor
    );
    expect(selfTypeConversion.targetDefinitions.primary.placeholder).toBe(
      'self'
    );

    const customScopeAction = {
      id: 'legacy:custom',
      name: 'Custom Scope',
      targets: 'custom.scope',
    };
    const customScopeConversion = legacyLayer.convertLegacyFormat(
      customScopeAction,
      actor
    );
    expect(customScopeConversion.targetDefinitions.primary.description).toBe(
      'Target from scope: custom.scope'
    );
  });

  it('marks none-scope actions optional and provides migration guidance', async () => {
    const locationDef = new EntityDefinition('test:none-location', {
      description: 'Quiet room',
      components: {
        'core:name': { text: 'Meditation Chamber' },
      },
    });

    const actorDef = new EntityDefinition('test:none-actor', {
      description: 'Actor with minimal data',
      components: {
        'core:actor': {},
        'core:name': { text: 'Meditator' },
        'core:position': { locationId: 'location-100' },
      },
    });

    entityTestBed.setupDefinitions(locationDef, actorDef);
    await entityManager.createEntityInstance('test:none-location', {
      instanceId: 'location-100',
    });
    const actor = await entityManager.createEntityInstance('test:none-actor', {
      instanceId: 'actor-100',
    });

    const waitAction = {
      id: 'legacy:wait',
      name: 'Wait',
      template: 'wait patiently',
      scope: 'none',
    };

    const context = {
      candidateActions: [waitAction],
      actor,
      actionContext: { actor },
      data: {},
    };

    const result = await stage.executeInternal(context);
    expect(result.success).toBe(true);
    const [entry] = result.data.actionsWithTargets;
    expect(entry.targetContexts).toHaveLength(0);
    expect(entry.targetDefinitions.primary).toEqual(
      expect.objectContaining({ scope: 'none', placeholder: 'target' })
    );

    const migrationSuggestion = JSON.parse(
      legacyLayer.getMigrationSuggestion(waitAction)
    );
    expect(migrationSuggestion.targets.primary.scope).toBe('none');

    const validation = legacyLayer.validateConversion(waitAction, {
      primary: { scope: 'none', placeholder: 'target' },
    });
    expect(validation.valid).toBe(true);

    const mismatchValidation = legacyLayer.validateConversion(waitAction, {
      primary: { scope: 'actor', placeholder: 'target' },
      secondary: { scope: 'actor.items' },
    });
    expect(mismatchValidation.valid).toBe(false);
    expect(mismatchValidation.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Scope mismatch'),
        expect.stringContaining(
          'Legacy actions should only have primary target'
        ),
      ])
    );

    const missingPrimaryValidation = legacyLayer.validateConversion(
      waitAction,
      {}
    );
    expect(missingPrimaryValidation.valid).toBe(false);
    expect(missingPrimaryValidation.errors).toContain(
      'Modern format must include a primary target'
    );

    const nonLegacyConversion = legacyLayer.convertLegacyFormat(
      { ...migrationSuggestion, targets: migrationSuggestion.targets },
      actor
    );
    expect(nonLegacyConversion.error).toBe('Action is not in legacy format');

    const modernAction = {
      id: 'modern:test',
      targets: { primary: { scope: 'actor.items', placeholder: 'item' } },
    };
    expect(legacyLayer.getMigrationSuggestion(modernAction)).toBe(
      'Action is already in modern format'
    );
  });

  it('migrates targetType legacy actions and keeps stage results consistent', async () => {
    const locationDef = new EntityDefinition('test:partner-location', {
      description: 'Shared location',
      components: {
        'core:name': { text: 'Observation Deck' },
      },
    });

    const actorDef = new EntityDefinition('test:partner-actor', {
      description: 'Actor with partner references',
      components: {
        'core:actor': {},
        'core:name': { text: 'Lead' },
        'core:position': { locationId: 'location-200' },
        'relationships:partners': { ids: ['partner-001'] },
      },
    });

    const partnerDef = new EntityDefinition('test:partner', {
      description: 'Partner entity',
      components: {
        'core:name': { text: 'Partner' },
        'core:position': { locationId: 'location-200' },
      },
    });

    entityTestBed.setupDefinitions(locationDef, actorDef, partnerDef);
    await entityManager.createEntityInstance('test:partner-location', {
      instanceId: 'location-200',
    });
    const actor = await entityManager.createEntityInstance(
      'test:partner-actor',
      {
        instanceId: 'actor-200',
      }
    );
    await entityManager.createEntityInstance('test:partner', {
      instanceId: 'partner-001',
    });

    const legacyAction = {
      id: 'legacy:focus-partner',
      name: 'Focus on partner',
      template: 'focus your attention',
      targetType: 'partner',
      targetCount: 1,
    };

    const legacyContext = {
      candidateActions: [legacyAction],
      actor,
      actionContext: { actor },
      data: {},
    };

    const legacyResult = await stage.executeInternal(legacyContext);
    expect(legacyResult.success).toBe(true);
    const [legacyEntry] = legacyResult.data.actionsWithTargets;
    expect(legacyEntry.targetDefinitions.primary).toEqual(
      expect.objectContaining({
        scope: 'actor.partners',
        placeholder: 'partner',
        description: 'Partner entities',
      })
    );
    expect(legacyEntry.targetContexts[0]).toEqual(
      expect.objectContaining({
        entityId: 'partner-001',
        displayName: 'Partner',
      })
    );

    const suggestion = JSON.parse(
      legacyLayer.getMigrationSuggestion(legacyAction)
    );
    expect(suggestion.targets.primary.scope).toBe('actor.partners');
    expect(suggestion.targets.primary.placeholder).toBe('partner');

    const modernContext = {
      candidateActions: [suggestion],
      actor,
      actionContext: { actor },
      data: {},
    };

    const modernResult = await stage.executeInternal(modernContext);
    expect(modernResult.success).toBe(true);
    const [modernEntry] = modernResult.data.actionsWithTargets;
    expect(modernEntry.targetContexts[0]).toEqual(
      expect.objectContaining({
        entityId: 'partner-001',
        displayName: 'Partner',
      })
    );

    const invalidModernTargets = legacyLayer.validateConversion(legacyAction, {
      primary: { scope: 'actor.partners', placeholder: 'companion' },
      secondary: { scope: 'actor.items' },
    });
    expect(invalidModernTargets.valid).toBe(false);
    expect(invalidModernTargets.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Placeholder mismatch'),
        expect.stringContaining(
          'Legacy actions should only have primary target'
        ),
      ])
    );
  });
});
