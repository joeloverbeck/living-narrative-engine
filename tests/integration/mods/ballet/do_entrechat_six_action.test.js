/**
 * @file Integration tests for the ballet:do_entrechat_six action.
 * @description Covers the entrechat six jump action definition and rule side effects.
 */

import actionDefinition from '../../../../data/mods/ballet/actions/do_entrechat_six.action.json';
import ruleDefinition from '../../../../data/mods/ballet/rules/handle_do_entrechat_six.rule.json';
import conditionDefinition from '../../../../data/mods/ballet/conditions/event-is-action-do-entrechat-six.condition.json';
import { runBalletActionIntegrationTests } from './balletActionTestHelpers.js';

runBalletActionIntegrationTests({
  actionId: 'ballet:do_entrechat_six',
  actionFile: actionDefinition,
  ruleFile: ruleDefinition,
  conditionFile: conditionDefinition,
  displayName: 'Do Entrechat Six',
  template: 'do entrechat six',
  description: 'Execute vertical jump with six leg beats (batterie)',
  logMessageSuffix:
    'springs into the air with legs beating rapidly in precise crossing patterns',
});
