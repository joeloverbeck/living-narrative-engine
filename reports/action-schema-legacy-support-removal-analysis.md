# Action Schema Legacy Support Removal Analysis

**Date**: 2025-01-08  
**Project**: Living Narrative Engine  
**Analysis Type**: Architecture Impact Assessment  
**Status**: ❌ Migration **NOT COMPLETE** - Legacy Support Still Required

## Executive Summary

**CRITICAL FINDING**: The action migration is **NOT complete** as claimed. **29 action files** still use legacy single-target string format, making schema cleanup unsafe at this time.

**Recommendation**: Complete the remaining action migrations before attempting schema changes.

## Current Migration Status

### ✅ Migrated Actions (16 files)

Actions using the new object format with `{ "primary": {...} }`:

**Core Mod (2/5)**

- `movement:go` - Multi-target with direction selection
- `core:dismiss` - Single target with object format

**Violence Mod (2/2)** ✅ **COMPLETE**

- `violence:slap` - Single target format
- `violence:sucker_punch` - Single target format

**Sex Mod (4/4)** ✅ **COMPLETE**

- `sex:fondle_breasts` - Single target format
- `sex-penile-manual:fondle_penis` - Single target format
- `sex-penile-manual:rub_penis_over_clothes` - Single target format
- `sex-dry-intimacy:rub_vagina_over_clothes` - Single target format

**Positioning Mod (4/5)**

- `positioning:get_close` - Single target format
- `positioning:turn_around_to_face` - Single target format
- `physical-control:turn_around` - Single target format
- `positioning:kneel_before` - Single target format

**Other**

- `intimacy:adjust_clothing` - Single target format
- `clothing:remove_clothing` - Single target format (NEW - uses object format)

### ❌ Legacy Actions Requiring Migration (29 files)

**Intimacy Mod (22/23)** - **INCOMPLETE**

```
intimacy:accept_kiss_passively          → "intimacy:current_kissing_partner"
intimacy:break_kiss_gently              → "intimacy:current_kissing_partner"
intimacy:brush_hand                     → "positioning:close_actors"
intimacy:cup_face_while_kissing         → "intimacy:current_kissing_partner"
intimacy:explore_mouth_with_tongue      → "intimacy:current_kissing_partner"
intimacy:feel_arm_muscles               → "intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target"
intimacy:fondle_ass                     → "intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target"
intimacy:kiss_back_passionately         → "intimacy:current_kissing_partner"
intimacy:kiss_cheek                     → "intimacy:close_actors_facing_each_other"
intimacy:kiss_neck_sensually            → "intimacy:actors_with_arms_facing_each_other_or_behind_target"
intimacy:lean_in_for_deep_kiss          → "intimacy:actors_with_mouth_facing_each_other"
intimacy:lick_lips                      → "intimacy:close_actors_facing_each_other"
intimacy:massage_back                   → "intimacy:close_actors_facing_away"
intimacy:massage_shoulders              → "intimacy:actors_with_arms_facing_each_other_or_behind_target"
intimacy:nibble_earlobe_playfully       → "intimacy:close_actors_facing_each_other_or_behind_target"
intimacy:nibble_lower_lip               → "intimacy:current_kissing_partner"
intimacy:nuzzle_face_into_neck          → "intimacy:close_actors_facing_each_other"
intimacy:peck_on_lips                   → "intimacy:close_actors_facing_each_other"
intimacy:place_hand_on_waist            → "positioning:close_actors"
intimacy:pull_back_breathlessly         → "intimacy:current_kissing_partner"
intimacy:pull_back_in_revulsion         → "intimacy:current_kissing_partner"
intimacy:suck_on_neck_to_leave_hickey   → "intimacy:close_actors_facing_each_other_or_behind_target"
intimacy:suck_on_tongue                 → "intimacy:current_kissing_partner"
intimacy:thumb_wipe_cheek               → "intimacy:close_actors_facing_each_other"
```

**Core Mod (3/5)** - **INCOMPLETE**

```
core:follow         → "core:potential_leaders"
core:stop_following → "none"
core:wait           → "none"
```

**Positioning Mod (1/5)**

```
positioning:step_back → "none"
```

**Clothing Mod (0/1)** - Now uses object format ✅

- `clothing:remove_clothing` has been migrated to object format

## Schema Analysis

### Current Legacy Support Structure

The `action.schema.json` currently supports both formats through:

1. **oneOf Structure** (lines 55-90)
   - Option 1: String format (legacy) `"targets": "scope_id"`
   - Option 2: Object format (modern) `"targets": { "primary": {...} }`

2. **Deprecated 'scope' Property** (lines 92-104)
   - Marked as deprecated but still functional
   - Used for actions without 'targets' property

3. **anyOf Validation** (lines 165-185)
   - Ensures actions use either "targets" OR "scope" (not both)
   - Prevents conflicting target definitions

### Schema Cleanup Requirements

To remove legacy support, the following changes are needed:

#### Phase 1: Schema Simplification

```json
// REMOVE: oneOf structure (lines 55-90)
"targets": {
  "description": "Target configuration for the action",
  "type": "object",
  "description": "Multi-target configuration with named target roles",
  "properties": {
    "primary": {
      "$ref": "#/definitions/targetDefinition",
      "description": "Primary target (required for multi-target actions)"
    },
    "secondary": {
      "$ref": "#/definitions/targetDefinition",
      "description": "Secondary target (optional)"
    },
    "tertiary": {
      "$ref": "#/definitions/targetDefinition",
      "description": "Tertiary target (optional)"
    }
  },
  "required": ["primary"],
  "additionalProperties": false
}
```

#### Phase 2: Remove Deprecated Elements

- **Remove**: `scope` property definition (lines 92-104)
- **Remove**: `anyOf` validation block (lines 165-185)
- **Update**: Required properties to mandate `targets`

#### Phase 3: Update Schema Metadata

- **Update**: Schema description to remove legacy references
- **Update**: Examples to show only modern format
- **Remove**: Legacy format examples

## Code Impact Analysis

### LegacyTargetCompatibilityLayer Service

**File**: `src/actions/pipeline/services/implementations/LegacyTargetCompatibilityLayer.js`

**Functionality**:

- Detects legacy formats (string targets, scope property, targetType/targetCount)
- Converts legacy formats to modern multi-target format
- Provides migration suggestions and validation
- Maintains backward compatibility

**Removal Impact**:

- **Service can be completely removed** after migration
- **336 lines of code** can be eliminated
- **Interface file** also removable
- **Dependencies** need cleanup in:
  - `MultiTargetResolutionStage.js`
  - `ServiceFactory.js`
  - `tokens-pipeline.js`
  - `pipelineServiceRegistrations.js`

### Pipeline Stage Integration

**File**: `src/actions/pipeline/stages/MultiTargetResolutionStage.js`

**Current Integration**:

```javascript
// Lines 16, 81-84, 94
import { ILegacyTargetCompatibilityLayer } from '../services/interfaces/ILegacyTargetCompatibilityLayer.js';

validateDependency(
  legacyTargetCompatibilityLayer,
  'ILegacyTargetCompatibilityLayer'
);
this.#legacyLayer = legacyTargetCompatibilityLayer;
```

**Removal Changes**:

- Remove import and dependency injection
- Remove service validation and storage
- Remove legacy layer calls in processing pipeline
- Simplify target resolution logic

### Dependency Injection Updates

**Files requiring updates**:

- `src/dependencyInjection/registrations/pipelineServiceRegistrations.js`
- `src/dependencyInjection/tokens/tokens-pipeline.js`
- `src/actions/pipeline/services/ServiceFactory.js`

**Changes needed**:

- Remove service registration
- Remove dependency token
- Update factory creation logic
- Remove from pipeline stage constructor

## Migration Roadmap

### Phase 1: Complete Action Migrations (29 actions)

**Priority 1: Core Actions (3 actions)**

```bash
# Critical for basic functionality
core:follow, core:stop_following, core:wait
```

**Priority 2: Intimacy Actions (22 actions)**

```bash
# Large batch - consider scripted migration
intimacy:accept_kiss_passively, intimacy:break_kiss_gently, [...]
```

**Priority 3: Remaining Actions (1 action)**

```bash
# Low priority
positioning:step_back
```

### Phase 2: Schema Cleanup

1. **Remove oneOf structure** from `action.schema.json`
2. **Remove deprecated scope property**
3. **Remove anyOf validation blocks**
4. **Update required properties**
5. **Clean up examples and documentation**

### Phase 3: Code Cleanup

1. **Remove LegacyTargetCompatibilityLayer service**
2. **Remove interface file**
3. **Update MultiTargetResolutionStage**
4. **Update dependency injection**
5. **Remove service factory integration**

### Phase 4: Testing & Validation

1. **Update all related tests**
2. **Remove legacy format test cases**
3. **Add schema validation tests**
4. **Run comprehensive test suite**
5. **Validate all actions load correctly**

## Risk Assessment

### 🔴 HIGH RISK: Breaking Changes

- **29 actions will fail to load** if schema is changed before migration
- **Game functionality severely impacted** (core actions affected)
- **No backward compatibility** once legacy support removed

### 🟡 MEDIUM RISK: Code Dependencies

- **MultiTargetResolutionStage** tightly coupled to legacy layer
- **Pipeline service registration** needs careful refactoring
- **Test suite** requires comprehensive updates

### 🟢 LOW RISK: Schema Changes

- **Well-defined migration path** exists
- **Modern format already proven** in 16 actions
- **Clear validation rules** available

## Testing Strategy

### Pre-Migration Testing

1. **Validate current legacy actions** work correctly
2. **Test LegacyTargetCompatibilityLayer** conversion accuracy
3. **Verify schema validation** accepts both formats

### Migration Testing

1. **Test each migrated action** individually
2. **Validate template placeholders** work correctly
3. **Ensure scope resolution** functions as expected
4. **Check target filtering** operates properly

### Post-Migration Testing

1. **Schema validation** rejects legacy formats
2. **All actions load successfully** with new format
3. **Game functionality** remains unchanged
4. **Performance impact** assessment (expect improvement)

## Recommended Action Plan

### ❌ **DO NOT** Proceed with Schema Cleanup Yet

**Reasoning**: 29 actions still require migration. Schema changes would break existing functionality.

### ✅ **DO** Complete Action Migration First

**Steps**:

1. **Script the migration** using `LegacyTargetCompatibilityLayer.getMigrationSuggestion()`
2. **Migrate actions by priority** (Core → Intimacy → Others)
3. **Test each migration** thoroughly
4. **Validate game functionality** after each batch

### ✅ **DO** Prepare for Schema Cleanup

**Preparation**:

1. **Document current dependencies** on legacy support
2. **Plan code removal sequence** to avoid breaking changes
3. **Update test suites** to expect new format only
4. **Prepare rollback strategy** if issues arise

## Performance Impact

### Expected Improvements Post-Cleanup

- **Reduced schema validation complexity** (no oneOf evaluation)
- **Simplified target resolution pipeline** (no legacy conversion)
- **Smaller codebase** (336 lines removed from LegacyTargetCompatibilityLayer)
- **Cleaner dependency graph** (fewer service dependencies)

### Estimated Impact

- **Performance**: +5-10% faster action resolution
- **Memory**: -50KB reduction in service overhead
- **Maintainability**: Significant improvement with simpler codebase
- **Schema validation**: Faster with single format requirement

## Conclusion

The action schema legacy support removal cannot proceed safely until all 29 remaining legacy actions are migrated to the modern object format. The intimacy mod contains the majority (22/29) of unmigrated actions and should be the primary focus.

**Next Steps**:

1. ❌ **BLOCK schema cleanup** until migration complete
2. ✅ **Prioritize action migration** starting with core actions
3. ✅ **Use automated migration tools** where possible
4. ✅ **Comprehensive testing** after each migration batch

**Timeline Estimate**: 1-2 weeks for complete migration and cleanup, assuming careful testing at each phase.

---

_This analysis was generated on 2025-01-08 as part of the Living Narrative Engine architecture assessment._
