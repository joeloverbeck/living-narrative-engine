// Debug script to simulate macro expansion
const fs = require('fs');
const path = require('path');

// Read the rule file
const rulePath = path.join(__dirname, 'data/mods/hugging/rules/handle_release_hug.rule.json');
const rule = JSON.parse(fs.readFileSync(rulePath, 'utf8'));

console.log('=== ORIGINAL RULE (from disk) ===');
console.log('Total actions:', rule.actions.length);
console.log('Last action:', rule.actions[rule.actions.length - 1]);

// Read the macro file
const macroPath = path.join(__dirname, 'data/mods/core/macros/logSuccessAndEndTurn.macro.json');
const macro = JSON.parse(fs.readFileSync(macroPath, 'utf8'));

console.log('\n=== MACRO DEFINITION ===');
console.log('Macro ID:', macro.id);
console.log('Macro actions:');
macro.actions.forEach((action, i) => {
  console.log(`  ${i}: ${action.type}${action.parameters?.eventType ? ` → ${action.parameters.eventType}` : ''}`);
});

// Simulate expansion
const expandedActions = [...rule.actions];
const macroIndex = expandedActions.findIndex(a => a.macro === 'core:logSuccessAndEndTurn');
if (macroIndex !== -1) {
  console.log('\n=== EXPANSION SIMULATION ===');
  console.log('Found macro at index:', macroIndex);
  console.log('Before expansion, total actions:', expandedActions.length);

  // Replace macro reference with macro actions
  expandedActions.splice(macroIndex, 1, ...macro.actions);

  console.log('After expansion, total actions:', expandedActions.length);
  console.log('Last 5 actions:');
  expandedActions.slice(-5).forEach((action, i) => {
    const idx = expandedActions.length - 5 + i;
    console.log(`  ${idx}: ${action.type}${action.parameters?.eventType ? ` → ${action.parameters.eventType}` : ''}`);
  });
}
