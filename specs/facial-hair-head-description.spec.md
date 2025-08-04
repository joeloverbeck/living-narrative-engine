# Facial Hair Head Description Specification

## Problem Statement

Entities with head parts containing facial hair descriptors (e.g., `humanoid_head_bearded.entity.json`) are not displaying head descriptions in the final composed descriptions. Specifically, entries like "Head: bearded" are missing from the `description.component.json` output, despite the facial hair descriptor being properly defined and the body part description builder correctly extracting it.

### Example

Current output in `error_logs.txt`:

```
Hair: medium, brown, straight
Eyes: brown, round
Torso: muscular
...
```

Expected output:

```
Head: bearded
Hair: medium, brown, straight
Eyes: brown, round
Torso: muscular
...
```

## Technical Analysis

### Root Cause

The issue stems from the `descriptionOrder` array in `data/mods/anatomy/anatomy-formatting/default.json` not including "head" as a part type. The current configuration includes specific head sub-parts (hair, eye, face, ear, nose, mouth) but omits the head part itself.

Current `descriptionOrder`:

```json
[
  "build",
  "body_composition",
  "body_hair",
  "hair",
  "eye",
  "face",
  "ear",
  "nose",
  "mouth",
  "neck",
  ...
]
```

### Component Flow Analysis

1. **Entity Definition**: `humanoid_head_bearded.entity.json` properly defines:
   - `anatomy:part` component with `subType: "head"`
   - `descriptors:facial_hair` component with `style: "bearded"`

2. **Description Generation**: `BodyPartDescriptionBuilder` correctly:
   - Extracts the facial hair descriptor
   - Formats it as "bearded" (verified by tests)

3. **Body Composition**: `BodyDescriptionComposer`:
   - Iterates through `descriptionOrder` array
   - Skips "head" parts because "head" isn't in the order
   - Only processes sub-parts like "hair", "eye", etc.

## Proposed Solution

### 1. Add "head" to Description Order

Update `data/mods/anatomy/anatomy-formatting/default.json`:

```json
"descriptionOrder": [
  "build",
  "body_composition",
  "body_hair",
  "head",      // Add this line
  "hair",
  "eye",
  "face",
  "ear",
  "nose",
  "mouth",
  "neck",
  ...
]
```

Position "head" before "hair" to maintain logical ordering from top to bottom.

### 2. Ensure Head Part Formatting

The existing formatting system should handle head parts correctly once they're included in the order:

- `TextFormatter.capitalize()` will format "head" as "Head"
- `formatLabelValue()` will format as "Head: bearded"

## Implementation Steps

1. **Update Configuration**:
   - Edit `data/mods/anatomy/anatomy-formatting/default.json`
   - Add "head" to `descriptionOrder` array at position 3 (after "body_hair", before "hair")

2. **Verify Existing Code**:
   - Confirm `BodyDescriptionComposer` processes head parts when found in order
   - Ensure `PartGroupingStrategyFactory` handles single head parts correctly
   - Verify `TextFormatter` capitalizes "head" properly

3. **Update Schema** (if needed):
   - Check if `anatomy-formatting.schema.json` needs to include "head" in allowed values

## Expected Behavior

After implementation:

1. **Single Head with Facial Hair**:

   ```
   Head: bearded
   Hair: medium, brown, straight
   ...
   ```

2. **Multiple Facial Hair Styles**:
   - mustache → "Head: mustache"
   - goatee → "Head: goatee"
   - full-beard → "Head: full-beard"

3. **Head without Facial Hair**:
   - Should only show head description if other descriptors are present
   - Clean-shaven heads may not need explicit mention

## Test Scenarios

### Unit Tests

1. Verify "head" is included in `descriptionOrder`
2. Test `BodyDescriptionComposer` processes head parts
3. Verify formatting of head descriptions with various facial hair styles

### Integration Tests

1. Create full body with bearded head, verify "Head: bearded" appears
2. Test multiple head types (mustache, goatee, etc.)
3. Verify order: head appears before hair in final description

### Edge Cases

1. Head with no descriptors (should not appear)
2. Head with only non-display descriptors
3. Multiple heads (unusual but should be handled)

## Alternative Approaches Considered

1. **Merge with Face**: Could combine facial hair with "face" part type
   - Rejected: "face" and "head" are semantically different
   - Facial hair belongs to head, not face specifically

2. **Special Facial Hair Section**: Add dedicated facial hair line
   - Rejected: Breaks consistency with other part descriptions
   - Would require special handling logic

3. **Include in Hair Description**: Append to hair line
   - Rejected: Facial hair is independent of scalp hair
   - Would complicate hair description logic

## Migration Considerations

- No data migration needed - only configuration change
- Existing saved games will display correctly after update
- No breaking changes to APIs or data structures

## Performance Impact

Minimal - adds one iteration to the description order loop, which is negligible.

## Security Considerations

None - this is a display-only change with no security implications.

## Future Enhancements

Consider adding more head-specific descriptors:

- Head shape (oval, round, square)
- Head size (small, medium, large)
- Complexion descriptors specific to face/head
