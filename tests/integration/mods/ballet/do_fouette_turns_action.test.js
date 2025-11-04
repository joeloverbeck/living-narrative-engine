/**
 * @file Integration tests for the ballet:do_fouette_turns action.
 * @description Confirms the fouetté turns action metadata and handler workflow.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/do_fouette_turns.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_do_fouette_turns.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-do-fouette-turns.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:do_fouette_turns',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Fouetté Turns',
  template: 'do fouetté turns',
  description: 'Perform series of iconic whipping turns (8 or 16 repetitions)',
  logMessageSuffix:
    'begins a series of rapid whipping turns with unwavering focus',
});
