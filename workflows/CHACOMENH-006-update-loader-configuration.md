# CHACOMENH-006: Update Loader Configuration

**Phase**: Data Extraction & Processing  
**Priority**: Medium  
**Complexity**: Low  
**Dependencies**: CHACOMENH-001 (component definitions)  
**Estimated Time**: 1 hour

## Summary

Verify and update the component loader configuration to ensure the three new psychological component files are properly loaded during system initialization. Also check if default component injection rules are needed for entity creation.

## Background

The Living Narrative Engine uses a loader system to discover and register components at startup. Components in the core mod should be automatically discovered, but we need to verify the loader configuration includes the new files and determine if any default injection rules are required.

## Technical Requirements

### Files to Verify/Modify

1. **src/loaders/defaultLoaderConfig.js**
   - Verify component loader includes new files
   - Check glob patterns for component discovery

2. **src/entities/utils/defaultComponentInjector.js**
   - Determine if default injection needed
   - Add rules if components should be auto-added

3. **src/constants/essentialSchemas.js** (if needed)
   - Register schemas for validation
   - Ensure components are validated

## Investigation Steps

### 1. Check Component Loader Configuration

First, examine how components are loaded:

```javascript
// In defaultLoaderConfig.js, look for:
const componentLoader = {
  pattern: 'data/mods/*/components/*.component.json',
  // OR
  directory: 'components',
  extension: '.component.json',
  // OR specific file lists
};
```

If using glob patterns, verify pattern matches new files:
- `data/mods/core/components/motivations.component.json` ✓
- `data/mods/core/components/internal_tensions.component.json` ✓
- `data/mods/core/components/core_dilemmas.component.json` ✓

### 2. Verify Auto-Discovery

If loader uses auto-discovery (likely case):
```javascript
// No changes needed if pattern like:
'data/mods/*/components/*.component.json'
// This will automatically include new files
```

If loader uses explicit file lists:
```javascript
// Would need to add:
const components = [
  // ... existing components ...
  'motivations.component.json',
  'internal_tensions.component.json',
  'core_dilemmas.component.json',
];
```

### 3. Check Default Injection Rules

Examine `defaultComponentInjector.js` to understand injection patterns:

```javascript
// Look for patterns like:
const defaultComponents = {
  'core:actor': {
    // Components automatically added to actors
    'core:description': {},
    'core:personality': {},
    // Should we add psychological components here?
  }
};
```

**Decision Point**: Should psychological components be automatically added?
- **No** (Recommended): Keep them optional for backward compatibility
- **Yes**: Would need to add default empty values

### 4. Schema Registration

Check if component schemas need explicit registration:

```javascript
// In essentialSchemas.js
const essentialComponentSchemas = [
  'core:actor',
  'core:description',
  // Do we need to add?
  'core:motivations',
  'core:internal_tensions',
  'core:core_dilemmas',
];
```

## Implementation Options

### Option A: No Changes Needed (Likely)

If the loader uses glob patterns and auto-discovery:
```javascript
// Existing configuration already handles new files
{
  components: {
    pattern: 'data/mods/*/components/*.component.json',
    loader: 'componentLoader',
  }
}
```

### Option B: Add to Explicit Lists

If explicit registration required:

```javascript
// defaultLoaderConfig.js
const coreComponents = [
  'actor.component.json',
  'description.component.json',
  // ... existing components ...
  'motivations.component.json',        // NEW
  'internal_tensions.component.json',  // NEW
  'core_dilemmas.component.json',      // NEW
];
```

### Option C: Add Default Injection (Not Recommended)

```javascript
// defaultComponentInjector.js
const psychologicalDefaults = {
  'core:motivations': { text: '' },
  'core:internal_tensions': { text: '' },
  'core:core_dilemmas': { text: '' },
};

// Only if we want ALL actors to have these components
```

## Testing Checklist

### Startup Verification
- [ ] Application starts without errors
- [ ] No schema validation errors in console
- [ ] Component registry includes new components

### Runtime Verification
- [ ] New components can be added to entities
- [ ] Components validate against schemas
- [ ] No performance degradation at startup

### Debug Verification

Add temporary logging to confirm loading:

```javascript
// Temporary debug code
console.log('Loaded components:', Object.keys(componentRegistry));
// Should include: 'core:motivations', 'core:internal_tensions', 'core:core_dilemmas'
```

## Acceptance Criteria

- [ ] Component loader configuration verified
- [ ] New components load at startup
- [ ] Schema validation works for new components
- [ ] No errors during initialization
- [ ] Components appear in registry
- [ ] Decision documented on default injection
- [ ] Backward compatibility maintained
- [ ] No performance impact on startup

## Decision Documentation

### Default Injection Decision

**Recommendation**: Do NOT add default injection rules

**Rationale**:
- Maintains backward compatibility
- Keeps components truly optional
- Reduces memory footprint for entities
- Allows gradual adoption
- Simplifies testing

**Implementation**:
- No changes to defaultComponentInjector.js
- Components added only when explicitly needed
- Content creators decide which characters need them

## Verification Commands

Run these commands to verify components load correctly:

```bash
# Start the application
npm run dev

# Check browser console for:
# - No validation errors
# - No missing schema errors
# - Component registry populated

# In browser console:
window.gameEngine?.dataRegistry?.components?.has('core:motivations')
// Should return: true
```

## Rollback Plan

If issues arise:
1. Remove any added configuration entries
2. Verify original files unchanged
3. Clear browser cache
4. Restart application

Most likely no rollback needed as changes are additive.

## Notes

- Most likely no changes needed due to auto-discovery
- If changes needed, they're minimal configuration updates
- Priority on maintaining backward compatibility
- Components should remain optional features

## Related Considerations

### Memory Impact
- Three additional schema validations at startup
- Minimal impact (< 1KB per schema)
- No runtime impact unless components used

### Performance Impact
- Negligible startup impact (< 10ms)
- No runtime performance change
- Schema validation cached after first use

### Compatibility Impact
- Full backward compatibility maintained
- Existing saves/games unaffected
- Optional adoption path

---

*Ticket created from character-components-analysis.md report*