/**
 * Test to confirm macro reference validation differs by position
 */

console.log('=== Testing Macro Reference Position Issue ===');

// Test 1: Minimal rule with root-level macro (like failing rule)
const rootLevelMacroRule = {
  "$schema": "schema://living-narrative-engine/rule.schema.json", 
  "event_type": "test:event",
  "actions": [
    {
      "type": "LOG",
      "parameters": {"message": "test"}
    },
    {
      "macro": "core:logSuccessAndEndTurn"  // ROOT LEVEL - should use MacroReference
    }
  ]
};

// Test 2: Rule with nested macro (like working rule) 
const nestedMacroRule = {
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "event_type": "test:event", 
  "actions": [
    {
      "type": "IF",
      "parameters": {
        "condition": {"var": "true"},
        "then_actions": [
          {
            "macro": "core:logSuccessAndEndTurn"  // NESTED LEVEL - should use NestedMacroReference
          }
        ]
      }
    }
  ]
};

console.log('Root-level macro rule:', JSON.stringify(rootLevelMacroRule, null, 2));
console.log('\n---\n');
console.log('Nested macro rule:', JSON.stringify(nestedMacroRule, null, 2));

console.log('\nThe issue is likely that AJV validation for root-level actions is failing');
console.log('to properly recognize macro references via the oneOf schema in operation.schema.json');