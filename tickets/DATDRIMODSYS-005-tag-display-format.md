# DATDRIMODSYS-005: Add Modifier Tag Display to Action Templates

## Summary

Extend `MultiTargetActionFormatter.js` to render active modifier tags in action templates. When modifiers are active, their tags should appear after the chance percentage (e.g., `restrain target (45% chance) [target restrained] [low light]`).

## File List

Files to modify:
- `src/actions/formatters/MultiTargetActionFormatter.js` (add tag rendering logic)

## Out of Scope

- **DO NOT** modify `ChanceCalculationService.js` (that's DATDRIMODSYS-004)
- **DO NOT** modify `ModifierCollectorService.js` (that's DATDRIMODSYS-003)
- **DO NOT** modify any schema files (that's DATDRIMODSYS-001)
- **DO NOT** add integration tests (that's DATDRIMODSYS-007)
- **DO NOT** modify any action JSON files

## Detailed Implementation

### 1. Update Chance Calculation Block in `#formatCombinations`

In the section that handles `{chance}` placeholder replacement (around line 160-190), extend to also inject tags:

```javascript
// Calculate chance per-combination for chance-based actions
if (
  actionDef.chanceBased?.enabled &&
  template.includes('{chance}') &&
  _options?.chanceCalculationService &&
  _options?.actorId
) {
  // ... existing target resolution logic ...

  if (canCalculate) {
    const displayResult =
      _options.chanceCalculationService.calculateForDisplay({
        actorId: _options.actorId,
        primaryTargetId: targetId,
        secondaryTargetId: combination.secondary?.[0]?.id,
        tertiaryTargetId: combination.tertiary?.[0]?.id,
        actionDef,
      });

    // Replace chance placeholder
    template = template.replace(
      '{chance}',
      displayResult.displayText.replace('%', '')
    );

    // Append modifier tags if present
    if (displayResult.activeTags && displayResult.activeTags.length > 0) {
      const tagsString = this.#formatModifierTags(displayResult.activeTags);
      template = this.#appendTagsToTemplate(template, tagsString);
    }
  }
}
```

### 2. Add Tag Formatting Helper Method

Add a new private method to format tags for display:

```javascript
/**
 * Format modifier tags for display in action template
 *
 * @private
 * @param {string[]} tags - Array of active modifier tags
 * @returns {string} Formatted tags string (e.g., "[tag1] [tag2]")
 */
#formatModifierTags(tags) {
  if (!tags || tags.length === 0) {
    return '';
  }

  // Filter empty/whitespace tags and format each with brackets
  return tags
    .filter((tag) => tag && tag.trim().length > 0)
    .map((tag) => `[${tag.trim()}]`)
    .join(' ');
}
```

### 3. Add Template Tag Insertion Helper

Add a method to intelligently insert tags into the template:

```javascript
/**
 * Append modifier tags to template string
 * Inserts tags before closing parenthesis if template ends with percentage,
 * otherwise appends at the end.
 *
 * @private
 * @param {string} template - Current template string
 * @param {string} tagsString - Formatted tags string
 * @returns {string} Template with tags appended
 */
#appendTagsToTemplate(template, tagsString) {
  if (!tagsString) {
    return template;
  }

  // Pattern: "action text (X% chance)" -> "action text (X% chance) [tags]"
  // Pattern: "action text (X%)" -> "action text (X%) [tags]"
  // Pattern: "action text" -> "action text [tags]"

  // Simply append tags at the end with a space
  return `${template} ${tagsString}`;
}
```

### 4. Update Parameter Passing

Ensure the `calculateForDisplay` call passes all target IDs correctly:

```javascript
// In #formatCombinations, update the calculateForDisplay call:
const displayResult =
  _options.chanceCalculationService.calculateForDisplay({
    actorId: _options.actorId,
    primaryTargetId: targetId,
    secondaryTargetId: combination.secondary?.[0]?.id ?? null,
    tertiaryTargetId: combination.tertiary?.[0]?.id ?? null,
    actionDef,
  });
```

### 5. Handle Edge Cases

Add defensive handling for various scenarios:

```javascript
// In the chance calculation block:
if (canCalculate) {
  try {
    const displayResult =
      _options.chanceCalculationService.calculateForDisplay({
        actorId: _options.actorId,
        primaryTargetId: targetId,
        secondaryTargetId: combination.secondary?.[0]?.id,
        tertiaryTargetId: combination.tertiary?.[0]?.id,
        actionDef,
      });

    // Replace chance placeholder (handle both {chance} and {chance}%)
    template = template.replace(
      '{chance}',
      displayResult.displayText.replace('%', '')
    );

    // Append modifier tags if present and not empty
    const activeTags = displayResult.activeTags ?? [];
    if (activeTags.length > 0) {
      const tagsString = this.#formatModifierTags(activeTags);
      if (tagsString) {
        template = this.#appendTagsToTemplate(template, tagsString);
      }
    }
  } catch (error) {
    this.#logger.warn('Failed to calculate chance for tag display', {
      actionId: actionDef.id,
      error: error.message,
    });
    // Continue without tags - don't break action display
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (create/update):
   - File: `tests/unit/actions/formatters/MultiTargetActionFormatter.tags.test.js`
   - Test cases:
     - `should format single tag correctly`
     - `should format multiple tags correctly`
     - `should filter empty tags`
     - `should filter whitespace-only tags`
     - `should append tags to template with chance percentage`
     - `should append tags to template without chance percentage`
     - `should handle empty activeTags array`
     - `should handle null activeTags gracefully`
     - `should handle tags with special characters`
     - `should preserve tag order from displayResult`

2. **Existing Tests**:
   - `npm run test:unit -- --testPathPattern="formatters" --silent` must pass
   - `npm run typecheck` must pass

### Invariants That Must Remain True

1. **No Breaking Changes**:
   - Templates without chance placeholders must render unchanged
   - Templates with chance but no modifiers must render unchanged
   - Existing action displays must not be affected

2. **Tag Format**:
   - Tags must be wrapped in square brackets: `[tag]`
   - Multiple tags must be space-separated: `[tag1] [tag2]`
   - Tags must appear after the chance percentage

3. **Tag Content**:
   - Maximum tag length is 30 characters (per schema)
   - Empty/whitespace tags must be filtered out
   - Tags must be trimmed of leading/trailing whitespace

4. **Error Resilience**:
   - Tag formatting errors must not break action display
   - Missing tags must result in normal display (no tags)
   - Invalid tag data must be logged and skipped

## Verification Commands

```bash
# Run unit tests for formatters
npm run test:unit -- --testPathPattern="formatters" --silent

# Check types
npm run typecheck

# Lint modified files
npx eslint src/actions/formatters/MultiTargetActionFormatter.js
```

## Dependencies

- **Depends on**: DATDRIMODSYS-004 (ChanceCalculationService must return `activeTags`)
- **Blocks**: DATDRIMODSYS-008 (Example migration needs tags to display)

## Visual Examples

### Before (Current)
```
restrain target (45% chance)
```

### After (With Modifiers)
```
restrain target (45% chance) [target restrained]
```

### Multiple Tags
```
swing at target (60% chance) [target prone] [low light] [flanking]
```

## Notes

- The spec limits tags to 30 characters to prevent UI overflow
- Tag order follows the order modifiers are evaluated (may be significant for display)
- This implementation appends tags at the end; future iterations may allow custom placement
- Consider CSS styling implications for the square bracket format
