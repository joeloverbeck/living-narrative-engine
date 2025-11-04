/**
 * @file Integration tests for the ballet:do_developpe_a_la_seconde action.
 * @description Validates the développé à la seconde action behavior and associated rule execution.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/do_developpe_a_la_seconde.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_do_developpe_a_la_seconde.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-do-developpe-a-la-seconde.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:do_developpe_a_la_seconde',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Développé à la Seconde',
  template: 'do développé à la seconde',
  description:
    'Unfold the leg slowly to second position with sustained extension',
  logMessageSuffix: 'slowly unfolds their leg to the side with perfect control',
});
