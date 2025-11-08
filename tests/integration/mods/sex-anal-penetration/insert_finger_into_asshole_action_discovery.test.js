import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';
import insertFingerIntoAssholeActionJson from '../../../../data/mods/sex-anal-penetration/actions/insert_finger_into_asshole.action.json' assert { type: 'json' };
import fs from 'fs';
import path from 'path';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';

describe('sex-anal-penetration:insert_finger_into_asshole action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_finger_into_asshole'
    );
    testFixture.testEnv.actionIndex.buildIndex([insertFingerIntoAssholeActionJson]);
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Load positioning condition needed by the custom scope
    const positioningCondition = await import('../../../../data/mods/positioning/conditions/actor-in-entity-facing-away.condition.json', {
      assert: { type: 'json' }
    });

    // Extend the dataRegistry mock to return the positioning condition
    const originalGetCondition = testFixture.testEnv.dataRegistry.getConditionDefinition;
    testFixture.testEnv.dataRegistry.getConditionDefinition = jest.fn((conditionId) => {
      if (conditionId === 'positioning:actor-in-entity-facing-away') {
        return positioningCondition.default;
      }
      return originalGetCondition(conditionId);
    });

    // Load and register the sex-anal-penetration mod's own scope
    const scopePath = path.join(
      process.cwd(),
      'data/mods/sex-anal-penetration/scopes/actors_with_exposed_asshole_accessible_from_behind.scope'
    );
    const scopeContent = fs.readFileSync(scopePath, 'utf-8');
    const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);

    // Register the mod's scope using ScopeEngine
    const scopeEngine = new ScopeEngine();

    for (const [scopeName, scopeAst] of parsedScopes) {
      const scopeResolver = (context) => {
        // Build runtime context with jsonLogicEval
        const runtimeCtx = {
          entityManager: testFixture.testEnv.entityManager,
          jsonLogicEval: testFixture.testEnv.jsonLogic,
          logger: testFixture.testEnv.logger,
        };

        // Pass the full context to scopeEngine.resolve - it expects context with actor/entity properties
        // The scope DSL starts with "actor.", so it needs context.actor to be defined
        const result = scopeEngine.resolve(scopeAst, context, runtimeCtx);

        // Return in the expected format for ScopeResolverHelpers
        return { success: true, value: result };
      };
      ScopeResolverHelpers._registerResolvers(
        testFixture.testEnv,
        testFixture.testEnv.entityManager,
        { [scopeName]: scopeResolver }
      );
    }
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action structure validation', () => {
    it('should have correct action metadata', () => {
      expect(insertFingerIntoAssholeActionJson).toMatchObject({
        id: 'sex-anal-penetration:insert_finger_into_asshole',
        name: 'Insert Finger into Asshole',
        template: "insert one finger into {primary}'s asshole",
      });
    });

    it('should have dark teal visual styling matching mod palette', () => {
      expect(insertFingerIntoAssholeActionJson.visual).toEqual({
        backgroundColor: '#053b3f',
        textColor: '#e0f7f9',
        hoverBackgroundColor: '#075055',
        hoverTextColor: '#f1feff',
      });
    });

    it('should have no anatomy prerequisites for actor', () => {
      expect(insertFingerIntoAssholeActionJson.prerequisites).toEqual([]);
    });

    it('should require positioning:closeness component on actor', () => {
      expect(insertFingerIntoAssholeActionJson.required_components).toEqual({
        actor: ['positioning:closeness'],
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('should be discovered when actor is close to target with exposed asshole accessible from behind', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice and expose his asshole
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };
      scenario.target.components['anatomy:body_part_types'] = {
        types: ['asshole'],
      };
      scenario.target.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).toContain('sex-anal-penetration:insert_finger_into_asshole');
    });

    it('should NOT be discovered when actors are not close', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Remove closeness components
      delete scenario.actor.components['positioning:closeness'];
      delete scenario.target.components['positioning:closeness'];

      // Setup target with exposed asshole facing away
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };
      scenario.target.components['anatomy:body_part_types'] = {
        types: ['asshole'],
      };
      scenario.target.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:insert_finger_into_asshole');
    });

    it("should NOT be discovered when target's asshole is covered", () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };
      scenario.target.components['anatomy:body_part_types'] = {
        types: ['asshole'],
      };
      // Cover the asshole socket
      scenario.target.components['clothing:socket_coverage'] = {
        sockets: { asshole: { covered: true } },
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:insert_finger_into_asshole');
    });

    it('should NOT be discovered when target does not have asshole body part', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice but without asshole
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };
      scenario.target.components['anatomy:body_part_types'] = {
        types: [],
      };
      scenario.target.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:insert_finger_into_asshole');
    });
  });
});
