// Minimal test to verify macro expansion is working
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from './tests/common/mods/ModTestFixture.js';
import releaseHugRule from './data/mods/hugging/rules/handle_release_hug.rule.json' assert { type: 'json' };
import releaseHugCondition from './data/mods/hugging/conditions/event-is-action-release-hug.condition.json' assert { type: 'json' };

describe('Macro Expansion Verification', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'hugging',
      'hugging:release_hug',
      releaseHugRule,
      releaseHugCondition
    );
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('should have expanded logSuccessAndEndTurn macro in handle_release_hug rule', () => {
    // Get the loaded rule from data registry
    const dataRegistry = testFixture.testEnv.dataRegistry;

    console.log('\n=== DATA REGISTRY CHECK ===');
    console.log('DataRegistry exists:', !!dataRegistry);
    console.log('Registry type:', dataRegistry?.constructor?.name);

    // Check what rules are available
    const allRules = dataRegistry?.getAll?.('rules') || [];
    console.log('\nAll loaded rules:');
    allRules.forEach(r => console.log(`  - ${r.rule_id}`));

    const rule = dataRegistry.get('rules', 'hugging:handle_release_hug');

    console.log('\n=== LOADED RULE ===');
    console.log('Rule found:', !!rule);
    if (!rule) {
      throw new Error('Rule not found in data registry');
    }
    console.log('Rule ID:', rule.rule_id);
    console.log('Total actions:', rule.actions.length);
    console.log('\nLast 10 actions:');
    rule.actions.slice(-10).forEach((action, i) => {
      const idx = rule.actions.length - 10 + i;
      if (action.macro) {
        console.log(`  ${idx}: MACRO - ${action.macro}`);
      } else {
        console.log(`  ${idx}: ${action.type}${action.parameters?.eventType ? ` → ${action.parameters.eventType}` : ''}`);
      }
    });

    // Verify no macro references remain
    const macroRefs = rule.actions.filter(a => a.macro);
    console.log('\n=== MACRO REFERENCES ===');
    console.log('Remaining macro references:', macroRefs.length);

    expect(macroRefs.length).toBe(0);

    // Verify DISPATCH_EVENT operations exist
    const dispatchEvents = rule.actions.filter(a => a.type === 'DISPATCH_EVENT');
    console.log('\n=== DISPATCH_EVENT OPERATIONS ===');
    console.log('DISPATCH_EVENT count:', dispatchEvents.length);
    dispatchEvents.forEach((op, i) => {
      console.log(`  ${i}: ${op.parameters?.eventType}`);
    });

    expect(dispatchEvents.length).toBeGreaterThan(0);

    // Verify specific events from logSuccessAndEndTurn macro
    const hasPerceptibleEvent = dispatchEvents.some(
      op => op.parameters?.eventType === 'core:perceptible_event'
    );
    const hasSuccessEvent = dispatchEvents.some(
      op => op.parameters?.eventType === 'core:display_successful_action_result'
    );
    const hasActionSuccessEvent = dispatchEvents.some(
      op => op.parameters?.eventType === 'core:action_success'
    );

    console.log('\n=== EXPECTED EVENTS FROM MACRO ===');
    console.log('Has core:perceptible_event:', hasPerceptibleEvent);
    console.log('Has core:display_successful_action_result:', hasSuccessEvent);
    console.log('Has core:action_success:', hasActionSuccessEvent);

    expect(hasPerceptibleEvent).toBe(true);
    expect(hasSuccessEvent).toBe(true);
    expect(hasActionSuccessEvent).toBe(true);
  });
});
