/**
 * @file Integration tests verifying FUMBLE outcome adds submerged component.
 * @description Validates the complete workflow: FUMBLE adds liquids-states:submerged,
 * which then blocks future swim attempts until the actor surfaces.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

import swimAction from '../../../../data/mods/liquids/actions/swim_to_connected_liquid_body.action.json';
import handleSwimRule from '../../../../data/mods/liquids/rules/handle_swim_to_connected_liquid_body.rule.json';

describe('FUMBLE outcome adds submerged component workflow', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'liquids',
      'liquids:swim_to_connected_liquid_body'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const setupSwimmingScenario = () => {
    const room1 = ModEntityScenarios.createRoom('room1', 'Lake Shore');
    const room2 = ModEntityScenarios.createRoom('room2', 'Deep Lake');

    const liquidBody1 = new ModEntityBuilder('liquid_body_1')
      .withName('Shallow Waters')
      .withComponent('liquids:liquid_body', {
        locationId: 'room1',
        connectedBodies: ['liquid_body_2'],
      })
      .build();

    const liquidBody2 = new ModEntityBuilder('liquid_body_2')
      .withName('Deep Waters')
      .withComponent('liquids:liquid_body', {
        locationId: 'room2',
        connectedBodies: ['liquid_body_1'],
      })
      .build();

    const actor = new ModEntityBuilder('actor1')
      .withName('Swimmer')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .build();

    // Actor is in liquid body, ready to swim
    actor.components['liquids-states:in_liquid_body'] = {
      liquid_body_id: 'liquid_body_1',
    };
    actor.components['skills:mobility_skill'] = { value: 10 };

    return {
      actor,
      room1,
      room2,
      liquidBody1,
      liquidBody2,
      entities: [room1, room2, actor, liquidBody1, liquidBody2],
    };
  };

  describe('Rule structure for FUMBLE outcome', () => {
    it('FUMBLE branch includes ADD_COMPONENT for submerged', () => {
      const fumbleBranch = handleSwimRule.actions.find(
        (op) =>
          op.type === 'IF' &&
          op.parameters?.condition?.['==']?.[1] === 'FUMBLE'
      );

      expect(fumbleBranch).toBeDefined();

      const addComponentOp = fumbleBranch.parameters.then_actions.find(
        (op) => op.type === 'ADD_COMPONENT'
      );

      expect(addComponentOp).toBeDefined();
      expect(addComponentOp.parameters.entity_ref).toBe('actor');
      expect(addComponentOp.parameters.component_type).toBe(
        'liquids-states:submerged'
      );
    });

    it('FUMBLE branch includes REGENERATE_DESCRIPTION after ADD_COMPONENT', () => {
      const fumbleBranch = handleSwimRule.actions.find(
        (op) =>
          op.type === 'IF' &&
          op.parameters?.condition?.['==']?.[1] === 'FUMBLE'
      );

      const actions = fumbleBranch.parameters.then_actions;
      const addIndex = actions.findIndex((op) => op.type === 'ADD_COMPONENT');
      const regenIndex = actions.findIndex(
        (op) => op.type === 'REGENERATE_DESCRIPTION'
      );

      expect(addIndex).toBeGreaterThan(-1);
      expect(regenIndex).toBeGreaterThan(-1);
      expect(regenIndex).toBeGreaterThan(addIndex);
    });

    it('FUMBLE branch does NOT update location (actor stays in place)', () => {
      const fumbleBranch = handleSwimRule.actions.find(
        (op) =>
          op.type === 'IF' &&
          op.parameters?.condition?.['==']?.[1] === 'FUMBLE'
      );

      const modifyPositionOp = fumbleBranch.parameters.then_actions.find(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters?.component_type === 'core:position'
      );

      expect(modifyPositionOp).toBeUndefined();
    });

    it('FUMBLE branch does NOT update liquid_body_id (actor stays in same body)', () => {
      const fumbleBranch = handleSwimRule.actions.find(
        (op) =>
          op.type === 'IF' &&
          op.parameters?.condition?.['==']?.[1] === 'FUMBLE'
      );

      const modifyLiquidBodyOp = fumbleBranch.parameters.then_actions.find(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters?.component_type === 'liquids-states:in_liquid_body'
      );

      expect(modifyLiquidBodyOp).toBeUndefined();
    });
  });

  describe('Narrative messaging validation', () => {
    it('FUMBLE perception text describes becoming submerged', () => {
      const fumbleBranch = handleSwimRule.actions.find(
        (op) =>
          op.type === 'IF' &&
          op.parameters?.condition?.['==']?.[1] === 'FUMBLE'
      );

      const dispatchOp = fumbleBranch.parameters.then_actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatchOp.parameters.description_text).toContain(
        'submerged in the liquid'
      );
      expect(dispatchOp.parameters.description_text).toContain(
        'struggles in an uncoordinated way'
      );
    });

    it('FUMBLE log message includes submerged state', () => {
      const fumbleBranch = handleSwimRule.actions.find(
        (op) =>
          op.type === 'IF' &&
          op.parameters?.condition?.['==']?.[1] === 'FUMBLE'
      );

      const setLogMessage = fumbleBranch.parameters.then_actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters?.variable_name === 'logMessage'
      );

      expect(setLogMessage.parameters.value).toContain('submerged');
    });
  });

  describe('Action discoverability after FUMBLE state', () => {
    it('swim action requires actor NOT to have submerged component', () => {
      expect(swimAction.forbidden_components?.actor).toContain(
        'liquids-states:submerged'
      );
    });

    it('swim action still requires in_liquid_body component', () => {
      expect(swimAction.required_components?.actor).toContain(
        'liquids-states:in_liquid_body'
      );
    });

    it('swim action requires mobility_skill component', () => {
      expect(swimAction.required_components?.actor).toContain(
        'skills:mobility_skill'
      );
    });
  });

  describe('Component lifecycle documentation', () => {
    it('verifies actor has in_liquid_body but NOT submerged initially', () => {
      const { actor, entities } = setupSwimmingScenario();

      testFixture.reset(entities);

      const inLiquidBody = testFixture.testEnv.entityManager.getComponentData(
        actor.id,
        'liquids-states:in_liquid_body'
      );
      const submerged = testFixture.testEnv.entityManager.getComponentData(
        actor.id,
        'liquids-states:submerged'
      );

      expect(inLiquidBody).toBeDefined();
      expect(inLiquidBody.liquid_body_id).toBe('liquid_body_1');
      // getComponentData returns null for non-existent components
      expect(submerged).toBeNull();
    });

    it('documents the FUMBLE → submerged → blocked swim workflow', () => {
      // This test documents the intended game design workflow:
      //
      // 1. Actor is in a liquid body (has liquids-states:in_liquid_body)
      // 2. Actor can discover swim_to_connected_liquid_body action
      // 3. Actor attempts to swim but rolls FUMBLE
      // 4. FUMBLE outcome adds liquids-states:submerged component
      // 5. Actor's description is regenerated to reflect submerged state
      // 6. Subsequent action discovery blocks swim action due to submerged
      // 7. Actor must use a "surface" or similar action to remove submerged
      // 8. Once surfaced, swim action becomes available again
      //
      // The test verifies the rule structure enforces steps 4-6.

      const fumbleBranch = handleSwimRule.actions.find(
        (op) =>
          op.type === 'IF' &&
          op.parameters?.condition?.['==']?.[1] === 'FUMBLE'
      );

      // Step 4: Verify ADD_COMPONENT
      const addComponent = fumbleBranch.parameters.then_actions.find(
        (op) =>
          op.type === 'ADD_COMPONENT' &&
          op.parameters?.component_type === 'liquids-states:submerged'
      );
      expect(addComponent).toBeDefined();

      // Step 5: Verify REGENERATE_DESCRIPTION
      const regenerate = fumbleBranch.parameters.then_actions.find(
        (op) => op.type === 'REGENERATE_DESCRIPTION'
      );
      expect(regenerate).toBeDefined();

      // Step 6: Verify action has forbidden component
      expect(swimAction.forbidden_components?.actor).toContain(
        'liquids-states:submerged'
      );
    });
  });
});
