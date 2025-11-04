/**
 * @file Integration tests for the ballet:do_tendus_en_croix action.
 * @description Validates the tendus en croix action metadata and ensures rule dispatches correct events.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/do_tendus_en_croix.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_do_tendus_en_croix.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-do-tendus-en-croix.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:do_tendus_en_croix',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Tendus en Croix',
  template: 'do tendus en croix',
  description:
    'Execute pointed foot extensions in cross pattern (front, side, back)',
  logMessageSuffix:
    'extends their pointed foot with razor precision through front, side, and back positions',
});
