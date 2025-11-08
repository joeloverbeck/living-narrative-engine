import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import '../../../common/mods/domainMatchers.js';
import pushGlansIntoAssholeActionJson from '../../../../data/mods/sex-anal-penetration/actions/push_glans_into_asshole.action.json' assert { type: 'json' };
import fs from 'fs';
import path from 'path';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';

describe('sex-anal-penetration:push_glans_into_asshole - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:push_glans_into_asshole'
    );
    testFixture.testEnv.actionIndex.buildIndex([pushGlansIntoAssholeActionJson]);
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Load positioning condition needed by the custom scope
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away'
    ]);

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
      expect(pushGlansIntoAssholeActionJson).toMatchObject({
        id: 'sex-anal-penetration:push_glans_into_asshole',
        name: 'Push Glans Into Asshole',
        template: "push your glans into {primary}'s asshole",
      });
    });

    it('should have dark teal visual styling matching mod palette', () => {
      expect(pushGlansIntoAssholeActionJson.visual).toEqual({
        backgroundColor: '#053b3f',
        textColor: '#e0f7f9',
        hoverBackgroundColor: '#075055',
        hoverTextColor: '#f1feff',
      });
    });

    it('should require positioning:closeness component on actor', () => {
      expect(pushGlansIntoAssholeActionJson.required_components).toEqual({
        actor: ['positioning:closeness'],
      });
    });

    it('should forbid positioning:fucking_anally component on actor', () => {
      expect(pushGlansIntoAssholeActionJson.forbidden_components).toEqual({
        actor: ['positioning:fucking_anally'],
      });
    });

    it('should have prerequisites for uncovered penis', () => {
      expect(pushGlansIntoAssholeActionJson.prerequisites).toHaveLength(2);
      expect(pushGlansIntoAssholeActionJson.prerequisites[0]).toMatchObject({
        logic: {
          hasPartOfType: ['actor', 'penis'],
        },
        failure_message: 'You need a penis to perform this action.',
      });
      expect(pushGlansIntoAssholeActionJson.prerequisites[1]).toMatchObject({
        logic: {
          not: {
            isSocketCovered: ['actor', 'penis'],
          },
        },
        failure_message: 'Your penis must be uncovered to perform this action.',
      });
    });
  });

  describe('Action discovery scenarios', () => {
    it('should be discovered when close actors with exposed asshole accessible from behind', () => {
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

      // Alice needs uncovered penis
      scenario.actor.components['anatomy:body_part_types'] = {
        types: ['penis'],
      };
      scenario.actor.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).toContain('sex-anal-penetration:push_glans_into_asshole');
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

      // Alice has uncovered penis
      scenario.actor.components['anatomy:body_part_types'] = {
        types: ['penis'],
      };
      scenario.actor.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
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

      // Alice has uncovered penis
      scenario.actor.components['anatomy:body_part_types'] = {
        types: ['penis'],
      };
      scenario.actor.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });

    it("should NOT be discovered when actor's penis is covered", () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice with exposed asshole
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };
      scenario.target.components['anatomy:body_part_types'] = {
        types: ['asshole'],
      };
      scenario.target.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      // Alice has penis but it's covered
      scenario.actor.components['anatomy:body_part_types'] = {
        types: ['penis'],
      };
      scenario.actor.components['clothing:socket_coverage'] = {
        sockets: { penis: { covered: true } },
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });

    it('should NOT be discovered when actor lacks penis anatomy', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice with exposed asshole
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };
      scenario.target.components['anatomy:body_part_types'] = {
        types: ['asshole'],
      };
      scenario.target.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      // Alice has no penis
      scenario.actor.components['anatomy:body_part_types'] = {
        types: [],
      };
      scenario.actor.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });

    it('should NOT be discovered when actor already has fucking_anally component', () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Make Bob face away from Alice with exposed asshole
      scenario.target.components['positioning:facing_away'] = {
        facing_away_from: [scenario.actor.id],
      };
      scenario.target.components['anatomy:body_part_types'] = {
        types: ['asshole'],
      };
      scenario.target.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      // Alice has uncovered penis
      scenario.actor.components['anatomy:body_part_types'] = {
        types: ['penis'],
      };
      scenario.actor.components['clothing:socket_coverage'] = {
        sockets: {},
      };

      // Alice is already fucking someone anally
      scenario.actor.components['positioning:fucking_anally'] = {
        being_fucked_entity_id: 'other_entity',
        initiated: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
      const ids = actions.map((action) => action.id);

      expect(ids).not.toContain('sex-anal-penetration:push_glans_into_asshole');
    });
  });
});
