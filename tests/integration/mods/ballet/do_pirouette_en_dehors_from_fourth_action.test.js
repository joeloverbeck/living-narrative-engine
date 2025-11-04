/**
 * @file Integration tests for the ballet:do_pirouette_en_dehors_from_fourth action.
 * @description Validates the en dehors pirouette from fourth action and associated rule flow.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/do_pirouette_en_dehors_from_fourth.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_do_pirouette_en_dehors_from_fourth.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-do-pirouette-en-dehors-from-fourth.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:do_pirouette_en_dehors_from_fourth',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Pirouette en Dehors from Fourth',
  template: 'do pirouette en dehors from fourth',
  description:
    'Execute outward turning pirouette with classical preparation and spotting',
  logMessageSuffix:
    'prepares in fourth position and executes a clean turning pirouette',
});
