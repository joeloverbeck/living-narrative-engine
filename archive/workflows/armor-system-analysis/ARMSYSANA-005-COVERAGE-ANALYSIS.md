# ARMSYSANA-005: Coverage-Related Components Analysis

**Analysis Date**: 2025-11-25  
**Status**: Comprehensive Discovery Complete  
**Task**: Find all coverage-related logic components for armor layer integration

## Executive Summary

Found **13 files** that handle clothing layers and need armor support review. **4 files** are critical and need updates. **9 files** are secondary and should be reviewed. The armor layer (priority 150) has been partially integrated but requires systematic updates across the coverage system.

---

## Critical Components Requiring Updates

### 1. **layerCompatibilityService.js** - NEEDS UPDATE

**File**: `src/clothing/validation/layerCompatibilityService.js`

**Purpose**: Validates layer compatibility, detects conflicts, handles multi-layer clothing scenarios

**Current Status**:

- Line 31: `static LAYER_ORDER = ['underwear', 'base', 'outer', 'accessories'];`
- **MISSING**: 'armor' layer in LAYER_ORDER array

**Required Changes**:

1. Add 'armor' to `LAYER_ORDER` array at line 31
2. Update `LAYER_REQUIREMENTS` static object to define armor requirements (line 38-41)
3. Update layer ordering validation logic (line 163-201) to handle armor positioning
4. Update dependent item finding logic (line 211-254) to account for armor layer

**Armor Priority Context**: Armor should be positioned between 'outer' (most visible) and 'base'. Proposed order: `['underwear', 'base', 'armor', 'outer', 'accessories']`

**Risk Level**: HIGH - This service validates all layer operations during clothing management

---

### 2. **slotAccessResolver.js** - NEEDS UPDATE

**File**: `src/scopeDsl/nodes/slotAccessResolver.js`

**Purpose**: Handles access to specific clothing slots and coverage resolution in scope DSL

**Current Status**:

- Line 99-109: `getCoveragePriorityFromMode()` function missing armor mapping
- Current mapping: `{ outer, base, underwear, accessories }`
- **MISSING**: armor → coverage priority mapping

**Required Changes**:

1. Add armor mapping to `layerToCoverage` object in `getCoveragePriorityFromMode()` (line 101-106)
2. Map armor to 'armor' coverage priority: `armor: 'armor'`

**Test Coverage**: Tests exist at:

- `tests/unit/scopeDsl/nodes/slotAccessResolver.test.js`
- `tests/unit/scopeDsl/nodes/slotAccessResolver.coverageFocused.test.js`
- `tests/unit/scopeDsl/nodes/slotAccessResolver.additionalScenarios.test.js`

**Risk Level**: MEDIUM - Controls scope DSL layer resolution

---

### 3. **BaseEquipmentOperator.js** - ALREADY COMPLETE ✅

**File**: `src/logic/operators/base/BaseEquipmentOperator.js`

**Status**: ARMOR SUPPORT ALREADY IMPLEMENTED

- Line 241: `isValidLayerName()` includes 'armor'
- Array: `['underwear', 'base', 'outer', 'accessories', 'armor']`
- **ARMOR IS PRESENT** ✅

**No Changes Needed**

---

### 4. **HasClothingInSlotLayerOperator.js** - ALREADY COMPLETE ✅

**File**: `src/logic/operators/hasClothingInSlotLayerOperator.js`

**Status**: ARMOR SUPPORT ALREADY IMPLEMENTED

- Line 68: Validation message includes: "Valid layers: underwear, base, outer, accessories, armor"
- Uses `isValidLayerName()` from BaseEquipmentOperator
- **ARMOR IS SUPPORTED** ✅

**No Changes Needed**

---

## Priority Constants (Already Updated - REFERENCE)

### **priorityConstants.js** - COMPLETE ✅

**File**: `src/scopeDsl/prioritySystem/priorityConstants.js`

**Status**: ARMOR FULLY INTEGRATED

```javascript
// Line 12: armor: 150 (between outer 100 and base 200)
// Line 24: armor: 15 (in layer priorities)
// Line 35: includes 'armor'
// Line 45: includes 'armor'
```

**No Changes Needed**

---

## Secondary Components Requiring Review

### 5. **priorityCalculator.js** - VERIFY COMPLETENESS

**File**: `src/scopeDsl/prioritySystem/priorityCalculator.js`

**Purpose**: Calculates coverage priority scores with caching

**Status**: Uses constants from `priorityConstants.js`

- Imports `COVERAGE_PRIORITY`, `LAYER_PRIORITY_WITHIN_COVERAGE`, `VALID_LAYERS`
- Since constants include armor, this file should work correctly
- **VALIDATION NEEDED**: Test armor priority calculation

**Required Actions**:

1. Verify `validatePriorityInputs()` (line 71-97) handles armor correctly
2. Check tests pass with armor values

**Risk Level**: LOW - Depends on constants which are correct

---

### 6. **coverageAnalyzer.js** - VERIFY COMPLETENESS

**File**: `src/clothing/analysis/coverageAnalyzer.js`

**Purpose**: Analyzes clothing coverage blocking for accessibility

**Status**: Uses `COVERAGE_PRIORITY` from constants

- Line 9: Imports `COVERAGE_PRIORITY` which includes armor
- `doesPriorityBlock()` (line 44-55) uses priority values
- **SHOULD WORK** if constants are correct

**Required Actions**:

1. Verify armor blocking logic works correctly in tests
2. Check coverage blocking behavior with armor items
3. Run coverage-specific tests

**Test Files**:

- `tests/unit/clothing/analysis/coverageAnalyzer.test.js`
- `tests/integration/clothing/coverageMappingSlotResolution.integration.test.js`

**Risk Level**: LOW - Depends on constants, but needs testing

---

### 7. **layerResolutionService.js** - POTENTIALLY NEEDS UPDATE

**File**: `src/clothing/services/layerResolutionService.js`

**Purpose**: Resolves clothing layer with Recipe > Entity > Blueprint precedence

**Status**: No hardcoded layer validation

- `resolveLayer()` (line 40-59) accepts any string value
- `validateLayerAllowed()` (line 68-90) checks against blueprint's `allowedLayers`
- **NO HARDCODED LAYERS** ✅

**Required Actions**:

1. Verify blueprint schemas include 'armor' in allowedLayers when applicable
2. Check anatomy recipe specifications include armor

**Risk Level**: LOW - Uses allowlist from data

---

### 8. **equipmentDescriptionService.js** - REVIEW NEEDED

**File**: `src/clothing/services/equipmentDescriptionService.js`

**Purpose**: Generates text descriptions of worn clothing

**Status**:

- No hardcoded layer lists found in first 100 lines
- Works with equipped items from component data
- **ACTION**: Verify description generation includes armor items

**Required Actions**:

1. Check if armor items appear in generated descriptions
2. Verify layer grouping includes armor when visible
3. Run equipment description tests with armor

**Risk Level**: LOW - Data-driven, but verify in tests

---

### 9. **clothingInstantiationService.js** - REVIEW NEEDED

**File**: `src/clothing/services/clothingInstantiationService.js`

**Purpose**: Handles instantiation and equipment of clothing from anatomy recipes

**Status**:

- Line 44: Comment mentions: "layer (underwear, base, outer, accessories)"
- **MISSING ARMOR** in comment/documentation
- No hardcoded layer validation found in first 100 lines

**Required Actions**:

1. Update JSDoc comment to include 'armor' as valid layer
2. Verify armor can be equipped during anatomy generation
3. Test armor item instantiation in anatomy recipes

**Risk Level**: MEDIUM - Documentation outdated, needs testing

---

### 10. **clothingAccessibilityService.js** - REVIEW NEEDED

**File**: `src/clothing/services/clothingAccessibilityService.js`

**Purpose**: Determines which clothing items are accessible based on coverage

**Status**:

- Imports and uses coverage-related components
- Likely delegates to coverageAnalyzer which handles priorities
- **ACTION**: Verify armor accessibility logic

**Required Actions**:

1. Test that armor items correctly block accessibility to lower layers
2. Verify armor appears in accessibility queries
3. Run accessibility integration tests with armor

**Risk Level**: MEDIUM - Critical for action discovery

---

### 11. **clothingManagementService.js** - REVIEW NEEDED

**File**: `src/clothing/services/clothingManagementService.js`

**Purpose**: Facade for clothing system operations

**Status**:

- Line 29: JSDoc mentions `allowedLayers` - needs validation
- Delegates to other services
- **ACTION**: Verify armor in blueprint slot mappings

**Required Actions**:

1. Check blueprint clothing slot configurations include armor
2. Verify armor items can be equipped through facade
3. Test armor in complete clothing workflows

**Risk Level**: MEDIUM - High-level API, delegates to services

---

### 12. **clothingHealthMonitor.js** - REVIEW NEEDED

**File**: `src/clothing/monitoring/clothingHealthMonitor.js`

**Purpose**: Health monitoring for clothing services

**Status**:

- Monitors all clothing services
- Doesn't hardcode layers itself
- **ACTION**: Ensure monitoring includes armor-related services

**Required Actions**:

1. Verify health checks cover armor-related operations
2. Check monitoring includes coverage blocking with armor
3. Run health check tests

**Risk Level**: LOW - Monitoring/diagnostics service

---

### 13. **equipmentOrchestrator.js** - REVIEW NEEDED

**File**: `src/clothing/orchestration/equipmentOrchestrator.js`

**Purpose**: Orchestrates complex equipment workflows

**Status**: Not yet reviewed in detail

- Coordinates equipment operations
- **ACTION**: Review armor handling in workflows

**Required Actions**:

1. Read full file to identify armor-specific logic
2. Verify equipment workflows handle armor layer
3. Test armor in orchestration flows

**Risk Level**: MEDIUM - Coordinates equipment operations

---

## Analysis Details

### Pattern Search Results

**Files with layer hardcoding**:

- ✅ `priorityConstants.js` - CORRECT (armor included)
- ✅ `BaseEquipmentOperator.js` - CORRECT (armor included)
- ✅ `HasClothingInSlotLayerOperator.js` - CORRECT (references BaseOperator)
- ❌ `layerCompatibilityService.js` - MISSING ARMOR
- ⚠️ `slotAccessResolver.js` - MISSING ARMOR MAPPING

**Files using priority system**:

- ✅ `priorityCalculator.js` - Uses constants (correct)
- ✅ `coverageAnalyzer.js` - Uses constants (correct)
- ⚠️ `slotAccessResolver.js` - Hardcoded mapping needed

**Files without hardcoding** (data-driven):

- ✅ `layerResolutionService.js` - Uses blueprint allowlist
- ✅ `equipmentDescriptionService.js` - Data-driven
- ✅ `clothingManagementService.js` - Delegates to services
- ⚠️ `clothingInstantiationService.js` - Documentation outdated

---

## Testing Components Found

**Existing test files** that cover these components:

- `tests/unit/scopeDsl/prioritySystem/priorityCalculator.test.js`
- `tests/unit/scopeDsl/prioritySystem/priorityConstants.test.js`
- `tests/unit/clothing/analysis/coverageAnalyzer.test.js`
- `tests/unit/clothing/validation/layerCompatibilityService.test.js`
- `tests/unit/clothing/services/equipmentDescriptionService.test.js`
- `tests/unit/scopeDsl/nodes/slotAccessResolver.*.test.js` (4 files)
- Integration and E2E tests for coverage workflows

**Coverage for armor updates**:

- Need to add armor-specific test cases to all unit tests
- Need integration tests for armor in complete workflows
- Need E2E tests for player-facing armor functionality

---

## Recommended Update Order

### Phase 1: Critical Updates (HIGH IMPACT)

1. **layerCompatibilityService.js** - Add armor to LAYER_ORDER
   - Enables armor in layer validation
   - Affects all clothing conflict detection

2. **slotAccessResolver.js** - Add armor to coverage mapping
   - Enables armor in scope DSL resolution
   - Affects action discovery and targeting

### Phase 2: Documentation & Testing (MEDIUM PRIORITY)

3. **clothingInstantiationService.js** - Update JSDoc
   - Clarify armor as valid layer
   - Document armor in recipe specs

4. Create/update tests for all 13 components
   - Unit tests for armor scenarios
   - Integration tests for armor workflows
   - E2E tests for armor equipment

### Phase 3: Verification (LOW PRIORITY)

5. Run full test suite with armor items
6. Verify armor in anatomy recipes
7. Test armor in action discovery and execution
8. Update documentation and examples

---

## Success Criteria

- [ ] All hardcoded layer arrays include 'armor'
- [ ] All switch/case statements on layers handle 'armor'
- [ ] All priority logic correctly values armor (150)
- [ ] All validation accepts armor as valid layer
- [ ] Unit tests pass for all 13 components with armor
- [ ] Integration tests verify armor in workflows
- [ ] Armor items appear in equipment descriptions
- [ ] Armor blocks accessibility to lower layers correctly
- [ ] Armor can be equipped through all APIs
- [ ] `npm run test:ci` passes without errors

---

## Files Not Requiring Changes

**Components that are armor-aware**:

- `priorityConstants.js` - ✅ Complete
- `BaseEquipmentOperator.js` - ✅ Complete
- `HasClothingInSlotLayerOperator.js` - ✅ Complete
- `priorityCalculator.js` - ✅ Uses constants
- `coverageAnalyzer.js` - ✅ Uses constants

**Anatomy system** (50+ files):

- No hardcoded layer lists found
- Uses entity component system
- Should work with armor through data-driven approach
- May need testing to verify

---

## Risk Assessment

| Component                    | Risk   | Reason                                     |
| ---------------------------- | ------ | ------------------------------------------ |
| layerCompatibilityService    | HIGH   | Direct validation logic, must handle armor |
| slotAccessResolver           | HIGH   | Controls scope DSL resolution              |
| coverageAnalyzer             | MEDIUM | Depends on correct priority values         |
| clothingAccessibilityService | MEDIUM | Critical for action discovery              |
| layerResolutionService       | LOW    | Data-driven via allowlists                 |
| equipmentDescriptionService  | LOW    | Works with component data                  |
| priorityCalculator           | LOW    | Uses correct constants                     |

---

## Files to Read Next

1. `src/clothing/services/equipmentOrchestrator.js` (full file - 500+ lines likely)
2. `src/clothing/services/clothingAccessibilityService.js` (full file)
3. `src/clothing/services/clothingManagementService.js` (continuation from line 100+)
4. `src/clothing/services/clothingInstantiationService.js` (continuation from line 100+)

---

## Related Tickets

- **ARMSYSANA-004**: Update priority constants (COMPLETED)
- **ARMSYSANA-005**: Update coverage logic (THIS TICKET)
- **ARMSYSANA-006**: Run comprehensive tests
- **ARMSYSANA-007**: Update documentation
- **ARMSYSANA-008**: Create armor examples

---

## Summary Table

| #   | File                              | Component            | Status          | Change                   | Risk   |
| --- | --------------------------------- | -------------------- | --------------- | ------------------------ | ------ |
| 1   | layerCompatibilityService.js      | Layer validation     | ❌ NEEDS UPDATE | Add armor to LAYER_ORDER | HIGH   |
| 2   | slotAccessResolver.js             | Coverage mapping     | ❌ NEEDS UPDATE | Add armor mapping        | MEDIUM |
| 3   | BaseEquipmentOperator.js          | Equipment validation | ✅ COMPLETE     | None                     | LOW    |
| 4   | HasClothingInSlotLayerOperator.js | Layer checking       | ✅ COMPLETE     | None                     | LOW    |
| 5   | priorityConstants.js              | Priority values      | ✅ COMPLETE     | None                     | LOW    |
| 6   | priorityCalculator.js             | Priority calc        | ✅ USES CONST   | Verify tests             | LOW    |
| 7   | coverageAnalyzer.js               | Coverage blocking    | ✅ USES CONST   | Verify tests             | LOW    |
| 8   | layerResolutionService.js         | Layer resolution     | ✅ DATA-DRIVEN  | Verify data              | LOW    |
| 9   | equipmentDescriptionService.js    | Description gen      | ⚠️ REVIEW       | Test armor               | LOW    |
| 10  | clothingInstantiationService.js   | Instantiation        | ⚠️ REVIEW       | Update docs              | MEDIUM |
| 11  | clothingAccessibilityService.js   | Accessibility        | ⚠️ REVIEW       | Test armor               | MEDIUM |
| 12  | clothingManagementService.js      | Facade               | ⚠️ REVIEW       | Test armor               | MEDIUM |
| 13  | equipmentOrchestrator.js          | Orchestration        | ⚠️ REVIEW       | Test armor               | MEDIUM |

---

_Analysis Generated: 2025-11-25_  
_Comprehensive armor layer integration analysis for ARMSYSANA-005_
