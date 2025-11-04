/**
 * @file Integration tests for the ballet:do_rond_de_jambe_a_terre action.
 * @description Checks the rond de jambe à terre action structure and macro-driven events.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/do_rond_de_jambe_a_terre.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_do_rond_de_jambe_a_terre.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-do-rond-de-jambe-a-terre.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:do_rond_de_jambe_a_terre',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Rond de Jambe à Terre',
  template: 'do rond de jambe à terre',
  description:
    'Trace circular leg movements along the floor with pure hip rotation',
  logMessageSuffix:
    'traces elegant circles with their working leg along the floor',
});
