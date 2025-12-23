/**
 * @file Integration tests for liquids:rise_to_surface action discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import riseToSurfaceAction from '../../../../data/mods/liquids/actions/rise_to_surface.action.json' assert { type: 'json' };

const ACTION_ID = 'liquids:rise_to_surface';

describe('liquids:rise_to_surface action discovery', () => {
  let fixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    fixture = new ModActionTestFixture('liquids', ACTION_ID, null, null);
    await fixture.initialize();

    configureActionDiscovery = () => {
      const { testEnv } = fixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([riseToSurfaceAction]);
    };
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  describe('Action structure', () => {
    it('has the expected action ID', () => {
      expect(riseToSurfaceAction.id).toBe(ACTION_ID);
    });

    it('has the expected template with liquidBody and chance placeholders', () => {
      expect(riseToSurfaceAction.template).toBe(
        'rise to the surface in the {liquidBody} ({chance}% chance)'
      );
      expect(riseToSurfaceAction.template).toContain('{liquidBody}');
      expect(riseToSurfaceAction.template).toContain('{chance}');
    });

    it('has correct primary target scope configuration', () => {
      expect(riseToSurfaceAction.targets.primary.scope).toBe(
        'liquids:liquid_body_actor_is_in'
      );
      expect(riseToSurfaceAction.targets.primary.placeholder).toBe('liquidBody');
      expect(riseToSurfaceAction.targets.primary.description).toBe(
        'Liquid body to rise to the surface of'
      );
    });

    it('uses the Blighted Moss visual scheme matching swim action', () => {
      expect(riseToSurfaceAction.visual).toEqual({
        backgroundColor: '#3aaea3',
        textColor: '#0b1f2a',
        hoverBackgroundColor: '#5ed0c6',
        hoverTextColor: '#0b1f2a',
      });
    });
  });

  describe('ChanceBased configuration', () => {
    it('has chanceBased enabled', () => {
      expect(riseToSurfaceAction.chanceBased.enabled).toBe(true);
    });

    it('uses fixed_difficulty contest type', () => {
      expect(riseToSurfaceAction.chanceBased.contestType).toBe('fixed_difficulty');
    });

    it('has fixed difficulty of 50', () => {
      expect(riseToSurfaceAction.chanceBased.fixedDifficulty).toBe(50);
    });

    it('uses mobility_skill as actor skill', () => {
      expect(riseToSurfaceAction.chanceBased.actorSkill.component).toBe(
        'skills:mobility_skill'
      );
      expect(riseToSurfaceAction.chanceBased.actorSkill.property).toBe('value');
      expect(riseToSurfaceAction.chanceBased.actorSkill.default).toBe(0);
    });

    it('has bounds of min 5 and max 95', () => {
      expect(riseToSurfaceAction.chanceBased.bounds.min).toBe(5);
      expect(riseToSurfaceAction.chanceBased.bounds.max).toBe(95);
    });

    it('has critical thresholds of 5 and 95', () => {
      expect(riseToSurfaceAction.chanceBased.outcomes.criticalSuccessThreshold).toBe(5);
      expect(riseToSurfaceAction.chanceBased.outcomes.criticalFailureThreshold).toBe(95);
    });
  });

  describe('Required components', () => {
    it('requires actor to have in_liquid_body, submerged, and mobility_skill', () => {
      expect(riseToSurfaceAction.required_components.actor).toEqual([
        'liquids-states:in_liquid_body',
        'liquids-states:submerged',
        'skills:mobility_skill',
      ]);
    });
  });

  describe('Forbidden components', () => {
    it('forbids being restrained, restraining, or fallen', () => {
      expect(riseToSurfaceAction.forbidden_components.actor).toEqual([
        'physical-control-states:being_restrained',
        'physical-control-states:restraining',
        'recovery-states:fallen',
      ]);
    });
  });

  describe('Scope resolution - liquid_body_actor_is_in', () => {
    it('returns the liquid body the actor is currently in', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Flooded Chamber');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Deep Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Submerged Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBody.id,
        })
        .withComponent('liquids-states:submerged', {})
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([room, liquidBody, actor]);

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:liquid_body_actor_is_in',
        {
          actor,
          actorEntity: actor,
        }
      );

      const ids = Array.from(result.value || []);
      expect(ids).toContain(liquidBody.id);
    });

    it('returns empty set when actor is not in any liquid body', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Dry Room');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Nearby Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Dry Person')
        .atLocation(room.id)
        .asActor()
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([room, liquidBody, actor]);

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:liquid_body_actor_is_in',
        {
          actor,
          actorEntity: actor,
        }
      );

      const ids = Array.from(result.value || []);
      expect(ids).toHaveLength(0);
    });
  });

  describe('Action discovery', () => {
    it('is discoverable when actor is submerged in a liquid body with all requirements', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Flooded Chamber');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Deep Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Submerged Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBody.id,
        })
        .withComponent('liquids-states:submerged', {})
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([room, liquidBody, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not discoverable when actor is not in a liquid body', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Dry Ground');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Nearby Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Dry Person')
        .atLocation(room.id)
        .asActor()
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([room, liquidBody, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when actor is not submerged (in liquid but on surface)', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Flooded Chamber');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Deep Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Surface Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBody.id,
        })
        // No submerged component - actor is on the surface
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([room, liquidBody, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when actor lacks mobility skill', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Flooded Chamber');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Deep Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Unskilled Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBody.id,
        })
        .withComponent('liquids-states:submerged', {})
        // No skills:mobility_skill component
        .build();

      fixture.reset([room, liquidBody, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when actor is being restrained', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Flooded Chamber');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Deep Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Restrained Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBody.id,
        })
        .withComponent('liquids-states:submerged', {})
        .withComponent('skills:mobility_skill', { value: 50 })
        .withComponent('physical-control-states:being_restrained', {
          restrainer_id: 'some_entity',
        })
        .build();

      fixture.reset([room, liquidBody, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when actor is restraining another', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Flooded Chamber');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Deep Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Restraining Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBody.id,
        })
        .withComponent('liquids-states:submerged', {})
        .withComponent('skills:mobility_skill', { value: 50 })
        .withComponent('physical-control-states:restraining', {
          restrained_id: 'some_entity',
        })
        .build();

      fixture.reset([room, liquidBody, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when actor is fallen', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Flooded Chamber');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Deep Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Fallen Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBody.id,
        })
        .withComponent('liquids-states:submerged', {})
        .withComponent('skills:mobility_skill', { value: 50 })
        .withComponent('recovery-states:fallen', {})
        .build();

      fixture.reset([room, liquidBody, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
