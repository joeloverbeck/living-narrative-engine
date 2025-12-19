/**
 * @file Integration tests for handle_push_onto_lying_furniture rule wiring and sense-aware perception.
 * @description Validates condition wiring, DISPATCH_PERCEPTIBLE_EVENT with actor/target descriptions for multi-target action.
 */

import { describe, it, expect } from '@jest/globals';
import handlePushOntoLyingFurnitureRule from '../../../../data/mods/physical-control/rules/handle_push_onto_lying_furniture.rule.json' assert { type: 'json' };
import eventIsActionPushOntoLyingFurniture from '../../../../data/mods/physical-control/conditions/event-is-action-push-onto-lying-furniture.condition.json' assert { type: 'json' };
import physicalControlManifest from '../../../../data/mods/physical-control/mod-manifest.json' assert { type: 'json' };

describe('handle_push_onto_lying_furniture rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handlePushOntoLyingFurnitureRule.rule_id).toBe(
      'handle_push_onto_lying_furniture'
    );
    expect(handlePushOntoLyingFurnitureRule.event_type).toBe(
      'core:attempt_action'
    );
    expect(handlePushOntoLyingFurnitureRule.condition.condition_ref).toBe(
      'physical-control:event-is-action-push-onto-lying-furniture'
    );

    expect(eventIsActionPushOntoLyingFurniture.id).toBe(
      'physical-control:event-is-action-push-onto-lying-furniture'
    );
    expect(eventIsActionPushOntoLyingFurniture.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'physical-control:push_onto_lying_furniture',
    ]);

    expect(physicalControlManifest.content.rules).toContain(
      'handle_push_onto_lying_furniture.rule.json'
    );
    expect(physicalControlManifest.content.conditions).toContain(
      'event-is-action-push-onto-lying-furniture.condition.json'
    );
  });

  it('sets up names for actor, primary, and secondary (furniture)', () => {
    const getNameOps = handlePushOntoLyingFurnitureRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );
    const primaryNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'primary'
    );
    const secondaryNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'secondary'
    );

    expect(actorNameOp?.parameters.result_variable).toBe('actorName');
    expect(primaryNameOp?.parameters.result_variable).toBe('primaryName');
    expect(secondaryNameOp?.parameters.result_variable).toBe('furnitureName');
  });

  it('sets up position lookup for actor', () => {
    const positionQuery = handlePushOntoLyingFurnitureRule.actions.find(
      (op) =>
        op.type === 'QUERY_COMPONENT' &&
        op.parameters.component_type === 'core:position'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');
  });

  it('breaks closeness between actor and primary target before action', () => {
    const breakCloseness = handlePushOntoLyingFurnitureRule.actions.find(
      (op) => op.type === 'BREAK_CLOSENESS_WITH_TARGET'
    );

    expect(breakCloseness).toBeDefined();
    expect(breakCloseness?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(breakCloseness?.parameters.target_id).toBe(
      '{event.payload.primaryId}'
    );
  });

  it('adds lying_down component to primary target with furniture reference', () => {
    const addComponent = handlePushOntoLyingFurnitureRule.actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'positioning:lying_down'
    );

    expect(addComponent).toBeDefined();
    expect(addComponent?.parameters.entity_ref).toBe('primary');
    expect(addComponent?.parameters.value.furniture_id).toBe(
      '{event.payload.secondaryId}'
    );
  });

  it('locks primary target movement', () => {
    const lockMovement = handlePushOntoLyingFurnitureRule.actions.find(
      (op) => op.type === 'LOCK_MOVEMENT'
    );

    expect(lockMovement).toBeDefined();
    expect(lockMovement?.parameters.actor_id).toBe('{event.payload.primaryId}');
  });

  it('regenerates descriptions for both primary and actor', () => {
    const regenOps = handlePushOntoLyingFurnitureRule.actions.filter(
      (op) => op.type === 'REGENERATE_DESCRIPTION'
    );

    expect(regenOps.map((op) => op.parameters.entity_ref).sort()).toEqual([
      'actor',
      'primary',
    ]);
  });

  it('uses DISPATCH_PERCEPTIBLE_EVENT with sense-aware descriptions', () => {
    const dispatch = handlePushOntoLyingFurnitureRule.actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

    expect(dispatch).toBeDefined();
    expect(dispatch?.parameters.location_id).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} pushes {context.primaryName} down roughly onto {context.furnitureName}.'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I push {context.primaryName} down roughly onto {context.furnitureName}.'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} pushes me down roughly onto {context.furnitureName}.'
    );
    expect(dispatch?.parameters.perception_type).toBe('physical.target_action');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.primaryId}');
  });

  it('provides appropriate alternate descriptions for non-visual perception', () => {
    const dispatch = handlePushOntoLyingFurnitureRule.actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

    expect(dispatch?.parameters.alternate_descriptions).toBeDefined();
    expect(dispatch?.parameters.alternate_descriptions.auditory).toBe(
      'I hear the sounds of a struggle and someone being pushed down onto furniture nearby.'
    );
    expect(dispatch?.parameters.alternate_descriptions.tactile).toBe(
      'I feel vibrations as someone is pushed down onto furniture nearby.'
    );
  });

  it('sets logMessage for display and uses success outcome macro', () => {
    const logMessage = handlePushOntoLyingFurnitureRule.actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} pushes {context.primaryName} down roughly onto {context.furnitureName}.'
    );

    const hasSuccessMacro = handlePushOntoLyingFurnitureRule.actions.some(
      (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
    );
    expect(hasSuccessMacro).toBe(true);
  });
});
