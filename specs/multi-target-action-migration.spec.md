# Multi-Target Action Migration Specification

## 1. Executive Summary

This specification outlines the migration strategy for converting all remaining legacy single-target actions in the Living Narrative Engine to the new multi-target format. The goal is to standardize all actions to use the modern `targets` property while maintaining backward compatibility until the legacy format can be safely deprecated.

## 2. Background

### 2.1 Current State

The Living Narrative Engine supports two action formats:

1. **Legacy Format**: Uses `scope` property for single targets
2. **Multi-Target Format**: Uses `targets` property with two valid formats:
   - **String format**: For single-target actions (e.g., `"targets": "core:potential_leaders"`)
   - **Object format**: For multi-target actions with named roles (e.g., `"targets": { "primary": {...}, "secondary": {...} }`)

Currently, the core mod has a mix of both formats:
- **Already Migrated**: `dismiss.action.json` (object format), `go.action.json` (object format)
- **Needs Migration**: `follow.action.json`, `stop_following.action.json`, `wait.action.json`

### 2.2 Benefits of Migration

- **Consistency**: All actions use the same format
- **Future-Proofing**: Easier to extend actions with additional targets
- **Code Simplification**: Eventually remove legacy format support
- **Better Documentation**: Explicit target descriptions and placeholders

## 3. Migration Strategy

### 3.1 Guiding Principles

1. **Backward Compatibility**: Event payloads must maintain `targetId` field
2. **Non-Breaking Changes**: Rules should continue working without modification
3. **Incremental Migration**: Actions can be migrated one at a time
4. **Comprehensive Testing**: All affected tests must pass

### 3.2 Event Payload Structure

The multi-target system ensures backward compatibility by providing multiple ways to access targets:

```javascript
// Legacy access (maintained for compatibility)
event.payload.targetId  // Primary target ID (always set for backward compatibility)

// Multi-target access (only present for multi-target actions)
event.payload.targets.primary    // Primary target ID
event.payload.targets.secondary  // Secondary target ID (if applicable)
event.payload.targets.tertiary   // Tertiary target ID (if applicable)

// Convenience fields (automatically added by MultiTargetEventBuilder#addFlattenedTargetIds)
event.payload.primaryId    // Same as targets.primary (or targetId for legacy)
event.payload.secondaryId  // Same as targets.secondary (null for legacy)
event.payload.tertiaryId   // Same as targets.tertiary (null for legacy)
```

**Note**: The flattened ID fields (`primaryId`, `secondaryId`, `tertiaryId`) are always present in the event payload, even for legacy actions, to provide a consistent interface for rules.

### 3.3 Target Property Formats

The `targets` property supports two formats to accommodate both simple and complex targeting needs:

#### String Format (Single-Target Actions)
For actions that only need a single target, the `targets` property can be a simple string:

```json
{
  "targets": "core:potential_leaders"
}
```

This is functionally equivalent to the legacy `scope` property but uses the modern property name.

#### Object Format (Multi-Target Actions)
For actions requiring multiple targets or advanced targeting features:

```json
{
  "targets": {
    "primary": {
      "scope": "core:potential_leaders",
      "placeholder": "target",
      "description": "The character to follow"
    },
    "secondary": {
      "scope": "inventory:items",
      "placeholder": "item",
      "description": "Optional item to give",
      "optional": true
    }
  }
}
```

**Important**: When migrating from legacy format, preserve the original placeholder names used in the template. For example, if `go.action.json` uses `{destination}` in its template, the migrated version should use `"placeholder": "destination"`.

## 4. Action-Specific Migrations

### 4.1 follow.action.json

**Current (Legacy)**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:follow",
  "name": "Follow",
  "description": "Commands your character to follow the specified target, becoming their companion and moving with them.",
  "scope": "core:potential_leaders",
  "required_components": {},
  "template": "follow {target}",
  "prerequisites": [...]
}
```

**Migrated Option 1 (String Format - Recommended for simple single-target)**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:follow",
  "name": "Follow",
  "description": "Commands your character to follow the specified target, becoming their companion and moving with them.",
  "targets": "core:potential_leaders",
  "required_components": {},
  "template": "follow {target}",
  "prerequisites": [...]
}
```

**Migrated Option 2 (Object Format - If future multi-target extension is anticipated)**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:follow",
  "name": "Follow",
  "description": "Commands your character to follow the specified target, becoming their companion and moving with them.",
  "targets": {
    "primary": {
      "scope": "core:potential_leaders",
      "placeholder": "target",
      "description": "The character to follow"
    }
  },
  "required_components": {},
  "template": "follow {target}",
  "prerequisites": [...]
}
```

**Rule Compatibility**: No changes needed. The rule accesses `event.payload.targetId` which is maintained for backward compatibility.

### 4.2 stop_following.action.json

**Current (Legacy)**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:stop_following",
  "name": "Stop Following",
  "description": "Stops following your current target and becomes independent again.",
  "scope": "none",
  "required_components": {
    "actor": ["core:following"]
  },
  "template": "stop following",
  "prerequisites": [...]
}
```

**Migrated (String Format)**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:stop_following",
  "name": "Stop Following",
  "description": "Stops following your current target and becomes independent again.",
  "targets": "none",
  "required_components": {
    "actor": ["core:following"]
  },
  "template": "stop following",
  "prerequisites": [...]
}
```

**Note**: For actions with no targets, `targets` is set to the string `"none"`.

**Rule Compatibility**: No changes needed. This action has no target.

### 4.3 wait.action.json

**Current (Legacy)**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:wait",
  "name": "Wait",
  "description": "Wait for a moment, doing nothing.",
  "scope": "none",
  "template": "wait",
  "prerequisites": []
}
```

**Migrated (String Format)**:
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "core:wait",
  "name": "Wait",
  "description": "Wait for a moment, doing nothing.",
  "targets": "none",
  "template": "wait",
  "prerequisites": []
}
```

**Rule Compatibility**: No changes needed. This action has no target.

## 5. Rule Analysis

### 5.1 Rules That Reference Targets

Based on analysis, the following rules reference `event.payload.targetId`:

1. **follow.rule.json** - Uses `targetId` extensively
2. **stop_following.rule.json** - References old leader via component data
3. **wait.rule.json** - No target references
4. **dismiss.rule.json** - Already handles multi-target format
5. **go.rule.json** - Already handles multi-target format

### 5.2 Backward Compatibility Strategy

The multi-target event builder ensures that `event.payload.targetId` always contains the primary target ID, making all existing rules compatible without modification.

### 5.3 Mixed-Format Processing

The `ActionFormattingStage` already supports processing a mix of legacy and multi-target actions in the same pipeline. This means:
- Actions can be migrated incrementally without breaking the system
- Both formats can coexist during the migration period
- The formatting stage automatically detects and handles each format appropriately
- Multi-target actions that fail formatting will automatically fall back to legacy formatting with the primary target

## 6. Test Impact Analysis

### 6.1 High-Priority Test Files

These test files directly test the actions being migrated:

1. **Unit Tests**:
   - `/tests/unit/actions/followActionTargetResolutionFix.test.js`
   - `/tests/unit/actions/actionDiscoverySystem.wait.test.js`
   - `/tests/unit/schemas/follow.schema.test.js`
   - `/tests/unit/schemas/stopFollowing.schema.test.js`
   - `/tests/unit/schemas/wait.schema.test.js`

2. **Integration Tests**:
   - `/tests/integration/rules/followRule.integration.test.js`
   - `/tests/integration/rules/stopFollowingRule.integration.test.js`
   - `/tests/integration/rules/waitRule.integration.test.js`
   - `/tests/integration/actions/followActionCircularBug.test.js`

3. **E2E Tests**:
   - Various e2e tests that use these actions as part of larger workflows

### 6.2 Test Update Strategy

Most tests should continue to work without modification due to backward compatibility. However, we should:

1. Verify all existing tests pass after migration
2. Add new tests that verify both string and object formats work correctly
3. Add tests that verify backward compatibility is maintained (event.payload.targetId)
4. Add tests that verify the flattened ID fields (primaryId, secondaryId, tertiaryId) are properly set
5. Ensure tests validate that the ActionFormattingStage handles mixed legacy/multi-target actions correctly

## 7. Implementation Phases

### Phase 1: Action Definition Updates (Week 1)
- Update `follow.action.json` to multi-target format
- Update `stop_following.action.json` to multi-target format
- Update `wait.action.json` to multi-target format
- Verify JSON schema validation passes

### Phase 2: Rule Verification (Week 1)
- Run all rule tests to ensure compatibility
- Document any unexpected behaviors
- No rule changes should be needed due to backward compatibility

### Phase 3: Comprehensive Testing (Week 2)
- Run full test suite
- Fix any failing tests
- Add new tests for multi-target format verification
- Performance testing to ensure no regression

### Phase 4: Documentation and Cleanup (Week 3)
- Update developer documentation
- Mark legacy format as deprecated in schema
- Plan for eventual removal of legacy support

## 8. Rollback Plan

If issues arise during migration:

1. Revert action definitions to legacy format
2. All rules and tests should automatically work again
3. Investigate and fix issues before re-attempting

## 9. Success Criteria

The migration is considered successful when:

1. All actions use the multi-target format
2. All existing tests pass without modification
3. New tests verify multi-target format works correctly
4. Performance benchmarks show no regression
5. Documentation is updated

## 10. Future Considerations

### 10.1 Legacy Format Removal

After successful migration and a stability period:

1. Remove `scope` property from action schema
2. Remove legacy format handling from action processing code
3. Update all documentation to only show multi-target format

### 10.2 Enhanced Multi-Target Features

The migration opens possibilities for:

1. Adding optional secondary targets to existing actions
2. Creating more complex multi-target interactions
3. Better target validation and error messages

### 10.3 Format Selection Guidelines

When migrating actions, consider:

**Use String Format When**:
- The action will always have exactly one target
- No additional target metadata is needed
- Simplicity is preferred
- The action mimics legacy behavior

**Use Object Format When**:
- Future multi-target support might be added
- Target descriptions improve documentation
- Custom placeholder names are needed
- The action might benefit from optional targets

## 11. Appendix: Code References

### Key Files for Migration

1. **Action Definitions**:
   - `/data/mods/core/actions/follow.action.json`
   - `/data/mods/core/actions/stop_following.action.json`
   - `/data/mods/core/actions/wait.action.json`

2. **Rules (No changes needed)**:
   - `/data/mods/core/rules/follow.rule.json`
   - `/data/mods/core/rules/stop_following.rule.json`
   - `/data/mods/core/rules/wait.rule.json`

3. **Core Implementation**:
   - `/src/entities/multiTarget/multiTargetEventBuilder.js` - Handles backward compatibility
   - `/src/actions/pipeline/stages/ActionFormattingStage.js` - Formats actions

### Migration Checklist

- [ ] Decide on string vs object format for each action:
  - [ ] follow.action.json - Recommend: string format (simple single-target)
  - [ ] stop_following.action.json - Required: string format ("none")
  - [ ] wait.action.json - Required: string format ("none")
- [ ] Update follow.action.json
- [ ] Update stop_following.action.json
- [ ] Update wait.action.json
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Run e2e tests
- [ ] Verify event payloads include flattened ID fields
- [ ] Test mixed legacy/multi-target action processing
- [ ] Update documentation
- [ ] Create migration guide for mod developers
- [ ] Performance testing
- [ ] Deploy and monitor