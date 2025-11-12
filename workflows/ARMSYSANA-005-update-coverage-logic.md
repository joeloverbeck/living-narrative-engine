# ARMSYSANA-005: Update Related Coverage Logic

**Phase**: Phase 2 - Priority System Update
**Priority**: High
**Risk Level**: Medium
**Estimated Effort**: 45 minutes

## Context

Beyond the `SlotAccessResolver`, there may be other components in the codebase that handle clothing coverage, layer resolution, or action text generation that need to be aware of the new "armor" layer.

This ticket involves discovering and updating any related coverage logic that may need armor support.

## Objective

Identify and update all coverage-related logic components to properly handle the armor layer, ensuring consistent behavior across the entire clothing system.

## Potential Components to Review

### 1. Coverage Analyzer

**Check if exists**: Search for `coverageAnalyzer` in the codebase

**Purpose**: May analyze clothing coverage for action text generation

**Potential Updates Needed**:
- Add armor priority handling
- Update coverage calculation logic
- Ensure armor is recognized in coverage maps

**Search Command**:
```bash
grep -r "coverageAnalyzer" src/
```

### 2. Action Text Generation System

**Location**: Likely in `src/actions/` or `src/domUI/`

**Purpose**: Generates text descriptions of character appearances including clothing

**Potential Updates Needed**:
- Recognize armor layer in descriptions
- Ensure armor appears in action text when visible
- Handle armor-specific description logic

**Search Commands**:
```bash
grep -r "clothing.*text" src/actions/
grep -r "layer.*description" src/domUI/
```

### 3. Clothing State Manager

**Check if exists**: Search for clothing state management components

**Purpose**: Manages the state of equipped clothing items

**Potential Updates Needed**:
- Handle armor layer in state tracking
- Update layer validation logic
- Ensure armor can be equipped/unequipped

**Search Command**:
```bash
grep -r "clothingState\|ClothingManager" src/
```

### 4. Equipment Slot Validators

**Location**: Likely in `src/entities/` or `src/validation/`

**Purpose**: Validates equipment slot assignments

**Potential Updates Needed**:
- Recognize armor as valid layer
- Validate armor-specific slot combinations
- Handle armor coverage validation

**Search Commands**:
```bash
grep -r "equipment.*validation\|slot.*validation" src/
```

### 5. Body Coverage System

**Location**: Likely in `src/anatomy/` or `src/clothing/`

**Purpose**: Tracks which body parts are covered by clothing

**Potential Updates Needed**:
- Include armor in coverage tracking
- Update coverage priority resolution
- Handle armor-specific coverage rules

**Search Commands**:
```bash
grep -r "bodyCoverage\|coverage.*tracking" src/
```

## Discovery Process

### Step 1: Identify Related Components

Run the following searches to find all clothing/coverage-related code:

```bash
# Search for layer-related code
grep -r "layer.*priority\|LAYER_PRIORITY" src/ --include="*.js"

# Search for coverage-related code
grep -r "coverage.*priority\|COVERAGE_PRIORITY" src/ --include="*.js"

# Search for clothing-related code
grep -r "wearable\|clothing.*layer" src/ --include="*.js"

# Search for layer enum usage
grep -r 'enum.*\["underwear".*"base".*"outer"' src/ --include="*.js"
```

### Step 2: Review Each Component

For each discovered component:

1. **Read the code** to understand its purpose
2. **Check if it references layers** (underwear, base, outer, accessories)
3. **Determine if armor support is needed**
4. **Identify specific changes required**

### Step 3: Document Findings

Create a list of all components that need updates:

| Component | File Path | Change Required | Priority |
|-----------|-----------|----------------|----------|
| Example | src/path/to/file.js | Add armor priority | High |

## Implementation Guidelines

For each component that needs updating:

### 1. Add Armor to Layer Lists

If the component has hardcoded layer lists:

```javascript
// OLD
const VALID_LAYERS = ['underwear', 'base', 'outer', 'accessories'];

// NEW
const VALID_LAYERS = ['underwear', 'base', 'outer', 'accessories', 'armor'];
```

### 2. Update Priority Logic

If the component has priority calculations:

```javascript
// Ensure armor is handled in priority logic
function getLayerPriority(layer) {
  switch (layer) {
    case 'outer': return 100;
    case 'armor': return 150;  // ADD THIS
    case 'base': return 200;
    case 'underwear': return 300;
    case 'accessories': return 350;
    default: return 400;
  }
}
```

### 3. Update Validation Logic

If the component validates layers:

```javascript
// Ensure armor is recognized as valid
function isValidLayer(layer) {
  return ['underwear', 'base', 'outer', 'accessories', 'armor'].includes(layer);
}
```

### 4. Update Coverage Resolution

If the component resolves coverage conflicts:

```javascript
// Ensure armor is handled in coverage resolution
function resolveVisibleLayer(layers) {
  // Should prioritize: outer > armor > base > underwear > accessories
  // Update logic to include armor
}
```

## Testing Requirements

For each updated component, create or update tests:

### Unit Tests

```javascript
describe('[ComponentName] - Armor Support', () => {
  it('should recognize armor as a valid layer', () => {
    // Test armor validation
  });

  it('should calculate correct priority for armor', () => {
    // Test armor priority
  });

  it('should resolve coverage with armor correctly', () => {
    // Test armor coverage resolution
  });
});
```

### Integration Tests

```javascript
describe('[ComponentName] Integration - Armor', () => {
  it('should handle armor in complete workflow', () => {
    // Test armor in full system integration
  });
});
```

## Validation Steps

After updating each component:

1. **Run component-specific tests**
   ```bash
   npm run test:unit -- tests/unit/[component-path]/
   ```

2. **Run integration tests**
   ```bash
   npm run test:integration -- tests/integration/[component-path]/
   ```

3. **Lint modified files**
   ```bash
   npx eslint [modified-files]
   ```

4. **Type check**
   ```bash
   npm run typecheck
   ```

## Common Patterns to Look For

### Pattern 1: Hardcoded Layer Arrays

```javascript
// NEEDS UPDATE
const layers = ['underwear', 'base', 'outer', 'accessories'];
```

### Pattern 2: Layer Switch Statements

```javascript
// NEEDS UPDATE
switch (layer) {
  case 'underwear': // ...
  case 'base': // ...
  case 'outer': // ...
  case 'accessories': // ...
  // Missing 'armor' case
}
```

### Pattern 3: Layer Priority Constants

```javascript
// NEEDS UPDATE
const PRIORITIES = {
  outer: 100,
  base: 200,
  underwear: 300,
  accessories: 350
  // Missing 'armor' priority
};
```

### Pattern 4: Layer Validation Regex

```javascript
// NEEDS UPDATE
const layerRegex = /^(underwear|base|outer|accessories)$/;
// Should include 'armor'
```

## Success Criteria

- [ ] All clothing/coverage-related components identified
- [ ] Each component reviewed for armor support needs
- [ ] All necessary components updated with armor support
- [ ] Unit tests pass for all updated components
- [ ] Integration tests pass for all updated components
- [ ] No hardcoded layer lists remain that exclude armor
- [ ] All priority logic includes armor tier
- [ ] `npm run test:ci` passes without errors

## Documentation

Document the following:

1. **Components Found**
   - List all components discovered
   - Note which ones needed updates
   - Note which ones didn't need changes

2. **Changes Made**
   - File path
   - Type of change
   - Reason for change

3. **Test Results**
   - Tests added or updated
   - Test results
   - Any issues encountered

## Related Tickets

- **Previous**: ARMSYSANA-004 (Update Slot Access Resolver)
- **Next**: ARMSYSANA-006 (Run Comprehensive Tests)
- **Depends On**: ARMSYSANA-001, ARMSYSANA-002, ARMSYSANA-004

## Notes

This ticket is **exploratory** - the exact components that need updating may not be fully known until the discovery process is complete.

Prioritize components based on:
1. **Critical Path**: Components used in action execution
2. **User-Facing**: Components that affect player experience
3. **Data Integrity**: Components that validate or store data

If a component is found that has extensive changes needed, consider creating a separate ticket for it.

## Reference

Files to definitely check:
- `src/scopeDsl/nodes/slotAccessResolver.js` (already handled in ARMSYSANA-004)
- `src/clothing/` directory (if it exists)
- `src/anatomy/` directory
- `src/actions/` directory (for action text generation)
- `src/validation/` directory (for layer validation)

The goal is to ensure that armor behaves consistently throughout the entire system, not just in the schema and priority resolver.
