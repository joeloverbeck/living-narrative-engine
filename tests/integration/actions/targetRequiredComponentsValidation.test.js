/**
 * @file Integration tests for target required components validation in action pipeline
 * @description End-to-end tests validating complete action discovery pipeline
 * correctly filters actions based on target required components.
 * @see src/actions/validation/TargetRequiredComponentsValidator.js
 * @see src/actions/pipeline/stages/TargetComponentValidationStage.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import TargetRequiredComponentsValidator from '../../../src/actions/validation/TargetRequiredComponentsValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import fs from 'fs';
import path from 'path';

describe('Target Required Components Validation - Integration', () => {
  let testBed;
  let entityManager;
  let validator;
  let logger;
  let playerEntity;
  let npc1Entity;
  let npc2Entity;
  let npc3Entity;
  let item1Entity;
  let item2Entity;
  let tertiaryEntity;

  beforeEach(async () => {
    // Set up test bed with entity manager
    testBed = new EntityManagerTestBed();
    entityManager = testBed.entityManager;

    // Create logger
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.info = jest.fn();

    // Create validator instance
    validator = new TargetRequiredComponentsValidator({ logger });

    // Create test entity definitions
    const playerDef = new EntityDefinition('test:player', {
      description: 'Test player',
      components: {
        'core:actor': { name: 'Test Player' },
        'personal-space-states:closeness': { entity: 'npc1', distance: 1 },
      },
    });

    const npc1Def = new EntityDefinition('test:npc1', {
      description: 'Sitting NPC with all required components',
      components: {
        'core:actor': { name: 'Test NPC' },
        'sitting-states:sitting_on': { furniture: 'chair1' },
        'personal-space-states:closeness': { entity: 'player', distance: 1 },
      },
    });

    const npc2Def = new EntityDefinition('test:npc2', {
      description: 'Standing NPC missing sitting_on',
      components: {
        'core:actor': { name: 'Standing NPC' },
        'personal-space-states:closeness': { entity: 'player', distance: 1 },
      },
    });

    const npc3Def = new EntityDefinition('test:npc3', {
      description: 'Sitting NPC missing closeness',
      components: {
        'core:actor': { name: 'Distant Sitting NPC' },
        'sitting-states:sitting_on': { furniture: 'chair2' },
      },
    });

    const item1Def = new EntityDefinition('test:item1', {
      description: 'Portable item',
      components: {
        'items:portable': { weight: 5 },
      },
    });

    const item2Def = new EntityDefinition('test:item2', {
      description: 'Container without portable',
      components: {
        'containers-core:container': { capacity: 10 },
      },
    });

    const tertiaryDef = new EntityDefinition('test:tertiary', {
      description: 'Tertiary target',
      components: {
        'items:portable': { weight: 3 },
      },
    });

    // Setup definitions
    testBed.setupDefinitions(
      playerDef,
      npc1Def,
      npc2Def,
      npc3Def,
      item1Def,
      item2Def,
      tertiaryDef
    );

    // Create entity instances directly using entityManager
    playerEntity = await entityManager.createEntityInstance('test:player');
    npc1Entity = await entityManager.createEntityInstance('test:npc1');
    npc2Entity = await entityManager.createEntityInstance('test:npc2');
    npc3Entity = await entityManager.createEntityInstance('test:npc3');
    item1Entity = await entityManager.createEntityInstance('test:item1');
    item2Entity = await entityManager.createEntityInstance('test:item2');
    tertiaryEntity = await entityManager.createEntityInstance('test:tertiary');
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  // Helper function to create compatible entity object for validator
  const createEntityObject = (entity) => {
    // Get all component types from the entity by checking what components it has
    const components = {};

    // Try to get definition from registry
    const def = testBed.mocks.registry.getEntityDefinition(entity.definitionId);
    if (def && def.components) {
      // Use the definition's component list to extract data
      Object.keys(def.components).forEach((componentId) => {
        if (entity.hasComponent(componentId)) {
          components[componentId] = entity.getComponentData(componentId);
        }
      });
    }

    return {
      id: entity.id,
      components,
    };
  };

  describe('straddling actions validation', () => {
    it('should discover straddle action when target has all required components', () => {
      const actionDef = {
        id: 'straddling:straddle_waist_facing',
        name: 'Straddle Waist (Facing)',
        targets: {
          primary: {
            scope: 'positioning:actors_sitting_close',
          },
        },
        required_components: {
          actor: ['personal-space-states:closeness'],
          primary: ['sitting-states:sitting_on', 'personal-space-states:closeness'],
        },
      };

      // npc1 has both required components
      const resolvedTargets = {
        primary: createEntityObject(npc1Entity),
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should filter straddle action when target missing sitting_on component', () => {
      const actionDef = {
        id: 'straddling:straddle_waist_facing',
        name: 'Straddle Waist (Facing)',
        targets: {
          primary: {
            scope: 'positioning:actors_sitting_close',
          },
        },
        required_components: {
          actor: ['personal-space-states:closeness'],
          primary: ['sitting-states:sitting_on', 'personal-space-states:closeness'],
        },
      };

      // npc2 missing sitting_on component
      const resolvedTargets = {
        primary: createEntityObject(npc2Entity),
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('sitting-states:sitting_on');
      expect(result.reason).toContain('primary');
    });

    it('should filter straddle action when target missing closeness component', () => {
      const actionDef = {
        id: 'straddling:straddle_waist_facing',
        name: 'Straddle Waist (Facing)',
        targets: {
          primary: {
            scope: 'positioning:actors_sitting_close',
          },
        },
        required_components: {
          actor: ['personal-space-states:closeness'],
          primary: ['sitting-states:sitting_on', 'personal-space-states:closeness'],
        },
      };

      // npc3 missing closeness component
      const resolvedTargets = {
        primary: createEntityObject(npc3Entity),
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('personal-space-states:closeness');
      expect(result.reason).toContain('primary');
    });
  });

  describe('multi-target validation', () => {
    it('should validate multiple targets with different requirements', () => {
      const actionDef = {
        id: 'test:multi_target_action',
        name: 'Multi-Target Action',
        targets: {
          primary: { scope: 'test:scope1' },
          secondary: { scope: 'test:scope2' },
        },
        required_components: {
          primary: ['sitting-states:sitting_on'],
          secondary: ['items:portable'],
        },
      };

      const resolvedTargets = {
        primary: createEntityObject(npc1Entity), // has sitting_on
        secondary: createEntityObject(item1Entity), // has portable
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should filter when secondary target missing required component', () => {
      const actionDef = {
        id: 'test:multi_target_action',
        name: 'Multi-Target Action',
        targets: {
          primary: { scope: 'test:scope1' },
          secondary: { scope: 'test:scope2' },
        },
        required_components: {
          primary: ['sitting-states:sitting_on'],
          secondary: ['items:portable'],
        },
      };

      const resolvedTargets = {
        primary: createEntityObject(npc1Entity), // has sitting_on - valid
        secondary: createEntityObject(item2Entity), // missing portable - invalid
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('items:portable');
      expect(result.reason).toContain('secondary');
    });
  });

  describe('backward compatibility', () => {
    it('should maintain support for actor-only required components', () => {
      const actionDef = {
        id: 'test:actor_only',
        name: 'Actor Only Action',
        required_components: {
          actor: ['personal-space-states:closeness'],
        },
      };

      const result = validator.validateTargetRequirements(actionDef, {});

      // Actor validation is not done by this validator (done elsewhere in pipeline)
      // So this should pass as no target requirements exist
      expect(result.valid).toBe(true);
    });

    it('should support legacy target format', () => {
      const actionDef = {
        id: 'test:legacy_target',
        name: 'Legacy Target Action',
        targets: {
          target: { scope: 'test:scope' },
        },
        required_components: {
          target: ['sitting-states:sitting_on'],
        },
      };

      const resolvedTargets = {
        target: createEntityObject(npc1Entity), // has sitting_on
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('error messages', () => {
    it('should provide clear error message for missing component', () => {
      const actionDef = {
        id: 'straddling:straddle_waist_facing',
        required_components: {
          primary: ['sitting-states:sitting_on', 'personal-space-states:closeness'],
        },
      };

      const resolvedTargets = {
        primary: createEntityObject(npc2Entity), // Missing sitting_on
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.reason).toMatch(
        /Target.*primary.*must have component.*sitting-states:sitting_on/
      );
    });

    it('should provide clear error message for missing target', () => {
      const actionDef = {
        id: 'test:action',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };

      const resolvedTargets = {}; // No primary target

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.reason).toContain('No primary target available');
    });
  });

  describe('target candidate resilience and logging', () => {
    it('should fail gracefully when target entity map is null', () => {
      const actionDef = {
        id: 'test:null_targets',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };

      const result = validator.validateTargetRequirements(actionDef, null);

      expect(result).toEqual({
        valid: false,
        reason: 'No target entities available for primary validation',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'No target entities provided for primary validation'
      );
    });

    it('should detect and report empty target arrays', () => {
      const actionDef = {
        id: 'test:empty_target_array',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };

      const result = validator.validateTargetRequirements(actionDef, {
        primary: [],
      });

      expect(result).toEqual({
        valid: false,
        reason: 'No primary target available for validation',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Empty primary target array for required components validation'
      );
    });

    it('should handle falsy target candidates without crashing', () => {
      const actionDef = {
        id: 'test:falsy_candidate',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };

      const result = validator.validateTargetRequirements(actionDef, {
        primary: [null],
      });

      expect(result).toEqual({
        valid: false,
        reason: 'No primary target available for validation',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Invalid primary target candidate encountered during required components validation'
      );
    });

    it('should treat wrappers without an entity reference as invalid candidates', () => {
      const actionDef = {
        id: 'test:missing_entity_reference',
        required_components: {
          primary: ['personal-space-states:closeness'],
        },
      };

      const result = validator.validateTargetRequirements(actionDef, {
        primary: [{ entity: null }],
      });

      expect(result).toEqual({
        valid: false,
        reason: 'No primary target available for validation',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Resolved primary target candidate lacks entity reference'
      );
    });

    it('should log hasComponent errors and surface missing component details', () => {
      const actionDef = {
        id: 'test:has_component_error',
        required_components: {
          primary: ['test:missing_component'],
        },
      };

      const problematicEntity = {
        id: 'problematic',
        components: {},
        hasComponent: () => {
          throw new Error('component lookup failed');
        },
      };

      const result = validator.validateTargetRequirements(actionDef, {
        primary: problematicEntity,
      });

      expect(result).toEqual({
        valid: false,
        reason: 'Target (primary) must have component: test:missing_component',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        "Error checking hasComponent('test:missing_component') on primary target problematic: component lookup failed"
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Target entity problematic missing required component: test:missing_component'
      );
    });
  });

  describe('real action files', () => {
    it('should correctly validate straddle_waist_facing.action.json', () => {
      // Load actual action file
      const actionPath = path.join(
        process.cwd(),
        'data/mods/straddling/actions/straddle_waist_facing.action.json'
      );

      let actionDef;
      try {
        const actionContent = fs.readFileSync(actionPath, 'utf-8');
        actionDef = JSON.parse(actionContent);
      } catch (error) {
        throw new Error(`Failed to load action file: ${error.message}`);
      }

      // Test with valid target
      const resolvedTargets = {
        primary: createEntityObject(npc1Entity), // has both sitting_on and closeness
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should correctly validate straddle_waist_facing_away.action.json', () => {
      // Load actual action file
      const actionPath = path.join(
        process.cwd(),
        'data/mods/straddling/actions/straddle_waist_facing_away.action.json'
      );

      let actionDef;
      try {
        const actionContent = fs.readFileSync(actionPath, 'utf-8');
        actionDef = JSON.parse(actionContent);
      } catch (error) {
        throw new Error(`Failed to load action file: ${error.message}`);
      }

      // Test with invalid target (missing sitting_on)
      const resolvedTargets = {
        primary: createEntityObject(npc2Entity), // missing sitting_on
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('sitting-states:sitting_on');
    });
  });

  describe('edge cases', () => {
    it('should pass validation when no required_components defined', () => {
      const actionDef = {
        id: 'test:no_requirements',
        name: 'No Requirements Action',
      };

      const result = validator.validateTargetRequirements(actionDef, {});

      expect(result.valid).toBe(true);
    });

    it('should pass validation when required_components is empty', () => {
      const actionDef = {
        id: 'test:empty_requirements',
        name: 'Empty Requirements Action',
        required_components: {},
      };

      const result = validator.validateTargetRequirements(actionDef, {});

      expect(result.valid).toBe(true);
    });

    it('should handle multiple missing components in error message', () => {
      // Create action requiring multiple components
      const actionDef = {
        id: 'test:multiple_requirements',
        required_components: {
          primary: [
            'sitting-states:sitting_on',
            'personal-space-states:closeness',
            'positioning:facing',
          ],
        },
      };

      // npc2 missing all three components
      const resolvedTargets = {
        primary: createEntityObject(npc2Entity),
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('sitting-states:sitting_on');
    });

    it('should handle tertiary target requirements', async () => {
      // Tertiary entity is now created in beforeEach
      const actionDef = {
        id: 'test:three_target_action',
        required_components: {
          primary: ['sitting-states:sitting_on'],
          secondary: ['items:portable'],
          tertiary: ['items:portable'],
        },
      };

      const resolvedTargets = {
        primary: createEntityObject(npc1Entity),
        secondary: createEntityObject(item1Entity),
        tertiary: createEntityObject(tertiaryEntity),
      };

      const result = validator.validateTargetRequirements(
        actionDef,
        resolvedTargets
      );

      expect(result.valid).toBe(true);
    });
  });
});
