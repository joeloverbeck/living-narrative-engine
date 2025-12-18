/**
 * @file Integration tests for ActivityMetadataCollectionSystem edge cases
 * @description Exercises fallback behaviour and failure handling across real collaborators
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityMetadataCollectionSystem from '../../../src/anatomy/services/activityMetadataCollectionSystem.js';

const TEST_COMPONENT_DEFINITIONS = {
  'activity:description_metadata': {
    id: 'activity:description_metadata',
    dataSchema: {
      type: 'object',
      properties: {},
    },
  },
  'test:inline_valid': {
    id: 'test:inline_valid',
    dataSchema: {
      type: 'object',
      properties: {
        targetId: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:inline_blank_target': {
    id: 'test:inline_blank_target',
    dataSchema: {
      type: 'object',
      properties: {
        targetId: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:inline_invalid_target': {
    id: 'test:inline_invalid_target',
    dataSchema: {
      type: 'object',
      properties: {
        targetId: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:inline_disabled': {
    id: 'test:inline_disabled',
    dataSchema: {
      type: 'object',
      properties: {
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:inline_malformed_metadata': {
    id: 'test:inline_malformed_metadata',
    dataSchema: {
      type: 'object',
      properties: {
        activityMetadata: {},
      },
    },
  },
  'test:inline_missing_template': {
    id: 'test:inline_missing_template',
    dataSchema: {
      type: 'object',
      properties: {
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:inline_parser_error': {
    id: 'test:inline_parser_error',
    dataSchema: {
      type: 'object',
      properties: {
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:inline_throwing_component': {
    id: 'test:inline_throwing_component',
    dataSchema: {
      type: 'object',
      properties: {
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:inline_invalid_data': {
    id: 'test:inline_invalid_data',
    dataSchema: {
      type: 'object',
      properties: {},
    },
  },
  'test:source_component': {
    id: 'test:source_component',
    dataSchema: {
      type: 'object',
      properties: {
        partner: { type: 'string' },
      },
    },
  },
};

/**
 * Reusable helper that ensures metadata collection system is instantiated with
 * the fully configured integration test bed logger and entity manager.
 *
 * @param {AnatomyIntegrationTestBed} testBed
 * @param {object} [options]
 * @returns {ActivityMetadataCollectionSystem}
 */
function createSystem(testBed, options = {}) {
  return new ActivityMetadataCollectionSystem({
    entityManager: testBed.entityManager,
    logger: testBed.mocks.logger,
    activityIndex: options.activityIndex ?? null,
  });
}

describe('ActivityMetadataCollectionSystem integration edge cases', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    testBed.loadComponents(TEST_COMPONENT_DEFINITIONS);
  });

  afterEach(() => {
    testBed.cleanup();
    jest.restoreAllMocks();
  });

  it('should fall back when the activity index misbehaves and still collect metadata from live collaborators', async () => {
    const indexError = new Error('index failure');
    const activityIndex = {
      findActivitiesForEntity: jest
        .fn()
        .mockImplementationOnce(() => 'not-an-array')
        .mockImplementationOnce(() => {
          throw indexError;
        })
        .mockImplementationOnce(() => [
          null,
          {
            type: 'index',
            sourceComponent: 'cached:summary',
            template: '{actor} is cached',
            priority: 10,
          },
        ]),
    };

    const system = createSystem(testBed, { activityIndex });

    // Unknown entity -> invalid index data branch + entity resolution warning
    expect(system.collectActivityMetadata('missing-entity')).toEqual([]);

    // Real entity with inline + dedicated metadata -> index throws but fallbacks succeed
    const actor = await testBed.entityManager.createEntityInstance(
      'core:actor',
      {
        instanceId: 'actor_edge',
      }
    );
    testBed.entityManager.addComponent(actor.id, 'test:inline_valid', {
      targetId: 'friend',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} waves at {target}',
        targetRole: 'targetId',
        priority: 55,
      },
    });
    testBed.entityManager.addComponent(actor.id, 'test:source_component', {
      partner: 'friend',
    });
    testBed.entityManager.addComponent(
      actor.id,
      'activity:description_metadata',
      {
        sourceComponent: 'test:source_component',
        descriptionType: 'verb',
        verb: 'waving',
        targetRole: 'partner',
        priority: 90,
        adverb: 'warmly',
        grouping: { groupKey: 'greeting' },
      }
    );

    const collected = system.collectActivityMetadata('actor_edge');
    const types = collected.map((item) => item.type).sort();
    expect(types).toEqual(['inline']);

    // Invalid entity identifier ensures EntityManager throws and returned activities are filtered
    const fromNullId = system.collectActivityMetadata(null);
    expect(fromNullId).toHaveLength(1);
    expect(fromNullId[0].type).toBe('index');
    expect(activityIndex.findActivitiesForEntity).toHaveBeenCalledTimes(3);
  });

  it('should scan inline metadata while tolerating malformed component data', async () => {
    const system = createSystem(testBed);

    // Guard clauses when entity reference is missing or incomplete
    expect(system.collectInlineMetadata(null)).toEqual([]);
    expect(
      system.collectInlineMetadata({
        id: 'broken',
        componentTypeIds: ['test:inline_valid'],
      })
    ).toEqual([]);

    const actor = await testBed.entityManager.createEntityInstance(
      'core:actor',
      {
        instanceId: 'inline_actor',
      }
    );

    // Register a dedicated metadata component to verify it is skipped when scanning inline sources
    testBed.entityManager.addComponent(
      actor.id,
      'activity:description_metadata',
      {
        sourceComponent: 'test:source_component',
      }
    );

    testBed.entityManager.addComponent(
      actor.id,
      'test:inline_invalid_data',
      {}
    );
    testBed.entityManager.addComponent(
      actor.id,
      'test:inline_malformed_metadata',
      {
        activityMetadata: {},
      }
    );
    testBed.entityManager.addComponent(
      actor.id,
      'test:inline_missing_template',
      {
        activityMetadata: {
          shouldDescribeInActivity: true,
        },
      }
    );
    testBed.entityManager.addComponent(actor.id, 'test:inline_blank_target', {
      targetId: '   ',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} bows to {target}',
        targetRole: 'targetId',
      },
    });
    testBed.entityManager.addComponent(actor.id, 'test:inline_invalid_target', {
      targetId: 42,
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} signals {target}',
        targetRole: 'targetId',
      },
    });
    testBed.entityManager.addComponent(actor.id, 'test:inline_disabled', {
      activityMetadata: {
        shouldDescribeInActivity: false,
        template: '{actor} should not appear',
      },
    });
    const parserErrorMetadata = {
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} glitches near {target}',
        targetRole: 'unstableRole',
      },
    };
    testBed.entityManager.addComponent(actor.id, 'test:inline_parser_error', {
      activityMetadata: parserErrorMetadata.activityMetadata,
    });
    testBed.entityManager.addComponent(
      actor.id,
      'test:inline_throwing_component',
      {
        targetId: 'friend',
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: '{actor} tries to contact {target}',
        },
      }
    );
    testBed.entityManager.addComponent(actor.id, 'test:inline_valid', {
      targetId: 'companion',
      activityMetadata: {
        shouldDescribeInActivity: true,
        template: '{actor} waves at {target}',
        targetRole: 'targetId',
        priority: 70,
      },
    });

    const originalGetComponentData = actor.getComponentData.bind(actor);
    actor.getComponentData = jest.fn((componentId) => {
      if (componentId === 'test:inline_throwing_component') {
        throw new Error('component data failure');
      }
      if (componentId === 'test:inline_invalid_data') {
        return 'invalid';
      }
      if (componentId === 'test:inline_malformed_metadata') {
        return {
          activityMetadata: 'not-an-object',
        };
      }
      if (componentId === 'test:inline_parser_error') {
        return new Proxy(parserErrorMetadata, {
          get(target, prop, receiver) {
            if (prop === 'unstableRole') {
              throw new Error('parser failure');
            }
            return Reflect.get(target, prop, receiver);
          },
        });
      }
      return originalGetComponentData(componentId);
    });

    const inlineActivities = system.collectInlineMetadata(actor);
    expect(inlineActivities).toHaveLength(3);

    const successfulInline = inlineActivities.find(
      (activity) => activity.sourceComponent === 'test:inline_valid'
    );
    expect(successfulInline).toBeDefined();
    expect(successfulInline.targetEntityId).toBe('companion');
    expect(successfulInline.priority).toBe(70);

    const blankTargetActivity = inlineActivities.find(
      (activity) => activity.sourceComponent === 'test:inline_blank_target'
    );
    expect(blankTargetActivity?.targetEntityId).toBeNull();

    const invalidTargetActivity = inlineActivities.find(
      (activity) => activity.sourceComponent === 'test:inline_invalid_target'
    );
    expect(invalidTargetActivity?.targetEntityId).toBeNull();
  });

  it('should deduplicate activities using production helpers', async () => {
    const system = createSystem(testBed);
    const hooks = system.getTestHooks();

    expect(system.deduplicateActivitiesBySignature('not-array')).toEqual([]);
    const duplicateActivities = system.deduplicateActivitiesBySignature([
      null,
      {
        type: 'inline',
        template: '{actor} waves',
        targetId: 'target-1',
        priority: 10,
      },
      {
        type: 'inline',
        template: '{actor} waves',
        targetId: 'target-1',
        priority: 15,
      },
      {
        type: 'inline',
        sourceComponent: 'test:inline_valid',
        targetId: 'target-1',
        priority: 5,
      },
      {
        type: 'dedicated',
        description: 'A calm presence',
        targetId: 'target-2',
      },
      {
        type: 'dedicated',
        verb: 'watching',
        adverb: 'closely',
        targetId: 'target-3',
      },
      {
        type: 'dedicated',
        targetId: 'target-4',
      },
    ]);

    expect(duplicateActivities).toHaveLength(5);
    expect(duplicateActivities[0].priority).toBe(15);

    expect(hooks.buildActivityDeduplicationKey(null)).toBe('invalid');
    expect(
      hooks.buildActivityDeduplicationKey({
        type: 'inline',
        template: '{actor} waves',
        targetEntityId: 'target-1',
        grouping: { groupKey: 'greeting' },
      })
    ).toBe('inline|template:{actor} waves|target:target-1|group:greeting');
    expect(
      hooks.buildActivityDeduplicationKey({
        type: 'inline',
        sourceComponent: 'test:inline_valid',
        targetId: 'target-2',
      })
    ).toBe('inline|source:test:inline_valid|target:target-2|group:none');
    expect(
      hooks.buildActivityDeduplicationKey({
        type: 'dedicated',
        description: 'Calm aura',
        targetId: 'target-3',
      })
    ).toBe('dedicated|description:calm aura|target:target-3|group:none');
    expect(
      hooks.buildActivityDeduplicationKey({
        type: 'dedicated',
        verb: 'watching',
        adverb: 'closely',
        targetId: 'target-4',
      })
    ).toBe('dedicated|verb:watching:closely|target:target-4|group:none');
    expect(
      hooks.buildActivityDeduplicationKey({
        type: 'generic',
      })
    ).toBe('generic|activity:generic|target:solo|group:none');

    const inlineParse = hooks.parseInlineMetadata(
      'test:inline_valid',
      { targetId: 'ally', activityMetadata: { template: '{actor} smiles' } },
      {
        template: '{actor} smiles',
        targetRole: 'targetId',
        priority: 30,
      }
    );
    expect(inlineParse.targetEntityId).toBe('ally');

    const invalidInlineParse = hooks.parseInlineMetadata(
      'test:inline_valid',
      { targetId: 42 },
      { template: null }
    );
    expect(invalidInlineParse).toBeNull();
  });
});
