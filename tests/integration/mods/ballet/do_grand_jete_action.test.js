/**
 * @file Integration tests for the ballet:do_grand_jete action.
 * @description Exercises the grand jeté action data and verifies the handler triggers turn ending effects.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/do_grand_jete.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_do_grand_jete.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-do-grand-jete.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:do_grand_jete',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Grand Jeté',
  template: 'do grand jeté',
  description: 'Execute heroic split leap with classical ballet preparation',
  logMessageSuffix:
    'executes a running preparation and launches into a soaring split leap',
});
