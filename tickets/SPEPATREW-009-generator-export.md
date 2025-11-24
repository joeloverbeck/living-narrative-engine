# SPEPATREW-009: Update Speech Patterns Generator Export Functionality

## Objective
Update the export functionality in the speech patterns generator to export structured format by default, with an option to export legacy format for backward compatibility.

## Priority
**Low** - Enhancement, not critical path

## Estimated Effort
0.5 days

## Dependencies
- **SPEPATREW-007** must be completed (processor handles both formats)
- **SPEPATREW-008** must be completed (UI displays both formats)

## Files to Touch
- `speech-patterns-generator.html` (embedded script section)

## Implementation Details

### Current Export Behavior
- Single export button
- Exports whatever format is generated
- No format conversion options

### New Export Behavior

#### Default Export
- Export structured format (object array)
- Use current generated patterns as-is
- File name: `speech-patterns-structured.json`

#### Legacy Export Option
- Add secondary button: "Export as Legacy"
- Convert structured to string format
- Conversion: `"(contexts: ${contexts.join(', ')}) 'examples: ${examples.join('; ')}"`
- File name: `speech-patterns-legacy.json`

### Conversion Logic
```javascript
function convertToLegacy(structuredPatterns) {
  return structuredPatterns.map(pattern => {
    const contextStr = pattern.contexts && pattern.contexts.length > 0
      ? `contexts: ${pattern.contexts.join(', ')}`
      : pattern.type;
    const exampleStr = pattern.examples.join('; ');
    return `(${contextStr}) '${exampleStr}'`;
  });
}
```

### UI Updates
Add two buttons:
1. "Export (Structured)" - primary action
2. "Export (Legacy)" - secondary action

### Button Behavior
- Both buttons export JSON files
- Use same download mechanism
- Different file names for clarity
- Legacy button only active if patterns exist
- Legacy button handles format detection (if already legacy, export as-is)

## Out of Scope
- **DO NOT** modify import functionality
- **DO NOT** change generation logic
- **DO NOT** modify display rendering
- **DO NOT** add bulk export of multiple characters
- **DO NOT** implement format migration tools
- **DO NOT** modify backend services
- **DO NOT** change response processing
- **DO NOT** add database persistence

## Acceptance Criteria

### Export Functionality Tests (Manual)
1. Generate structured patterns
2. Click "Export (Structured)" - downloads JSON with object array
3. Click "Export (Legacy)" - downloads JSON with string array
4. Verify structured export file is valid JSON
5. Verify legacy export file is valid JSON
6. Verify file names are different
7. Verify both formats load back into system

### Legacy Conversion Tests (Manual)
8. Generate structured patterns
9. Export as legacy
10. Verify string format includes contexts
11. Verify string format includes all examples
12. Verify format matches legacy pattern style
13. Load legacy export back into system
14. Verify it displays correctly

### Edge Cases (Manual)
15. Generate legacy patterns
16. Export as legacy - should work without conversion
17. Export structured from legacy - should fail gracefully or skip
18. Empty patterns - both buttons disabled
19. Single pattern - both exports work

### Button State Tests (Manual)
20. Before generation - both buttons disabled
21. After structured generation - both buttons enabled
22. After legacy generation - both buttons enabled
23. Clear patterns - buttons disabled again

### Invariants
- Export mechanism unchanged (still uses download)
- JSON structure matches schema
- No data loss in conversion
- File downloads work in all browsers
- No external dependencies added
- Existing export behavior preserved as default

## Validation Commands
```bash
# Type check (if applicable)
npm run typecheck

# Lint HTML/JS
npm run lint

# Manual testing required - see checklist below
```

## Manual Testing Checklist
```
[ ] Generate structured patterns
[ ] Export structured format
[ ] Open exported file - verify JSON valid
[ ] Verify object array structure
[ ] Export legacy format
[ ] Open exported file - verify JSON valid
[ ] Verify string array structure
[ ] Verify contexts included in strings
[ ] Verify examples included in strings
[ ] Import structured export back
[ ] Verify patterns display correctly
[ ] Import legacy export back
[ ] Verify patterns display correctly
[ ] Test with 1 pattern
[ ] Test with 8 patterns
[ ] Test with legacy generated patterns
[ ] Export legacy from legacy - verify no error
[ ] Test both buttons disabled when empty
[ ] Test file name differences
[ ] Test in Chrome
[ ] Test in Firefox
```

## Definition of Done
- [ ] Two export buttons implemented
- [ ] Structured export works (primary action)
- [ ] Legacy export works (secondary action)
- [ ] Conversion logic implemented
- [ ] Both formats produce valid JSON
- [ ] File names differ for clarity
- [ ] Button states correct (enabled/disabled)
- [ ] Manual testing checklist completed
- [ ] Both formats re-importable
- [ ] No regression in existing functionality
- [ ] Code review completed
- [ ] Documentation updated if needed
