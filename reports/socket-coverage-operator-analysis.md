# Socket Coverage Operator Implementation Analysis

**Date**: 2025-01-19  
**Focus**: Architecture analysis for implementing `isSocketCovered` operator  
**Scope**: Deep analysis of implementation options and architectural challenges

## Executive Summary

This analysis examines the architecture for implementing a new JSON Logic operator `isSocketCovered` that determines if specific anatomical sockets (e.g., 'vagina') are covered by clothing. The analysis reveals that the Living Narrative Engine's clothing system already provides the necessary infrastructure, requiring minimal architectural changes.

**Key Finding**: The existing clothing system architecture supports socket coverage queries through the `anatomySockets` mappings in clothing slot definitions. Implementation requires creating a new operator that leverages existing services with reverse mapping logic.

## Current Architecture Analysis

### Clothing System Overview

The Living Narrative Engine implements a sophisticated clothing attachment system with three key layers:

1. **JSON Logic Operators**: High-level query interface
2. **Clothing Management Service**: Business logic orchestration
3. **Socket Resolution Strategies**: Low-level anatomy attachment

### Existing Operators Architecture

#### BaseEquipmentOperator Foundation

```javascript
// Location: src/logic/operators/base/BaseEquipmentOperator.js
class BaseEquipmentOperator {
  // Provides common functionality:
  // - Entity path resolution
  // - Equipment component access
  // - Layer validation
  // - Error handling patterns
}
```

**Key Methods**:

- `getEquipmentData(entityId)`: Retrieves `clothing:equipment` component
- `hasItemsInSlot(equipmentData, slotName)`: Checks slot occupancy
- `hasItemsInSlotLayer(equipmentData, slotName, layerName)`: Layer-specific checks
- `isValidLayerName(layerName)`: Schema validation

#### Current Operators

**HasClothingInSlotOperator**:

- **Purpose**: Check if any clothing is equipped in a slot
- **Usage**: `{"hasClothingInSlot": ["actor", "torso_upper"]}`
- **Logic**: Slot → Equipment lookup

**HasClothingInSlotLayerOperator**:

- **Purpose**: Check if clothing is equipped in specific slot/layer
- **Usage**: `{"hasClothingInSlotLayer": ["actor", "torso_upper", "base"]}`
- **Logic**: Slot + Layer → Equipment lookup

### Socket-to-Slot Mapping System

#### Anatomy Socket Architecture

**Socket Definition** (from `human_female_torso.entity.json`):

```json
{
  "anatomy:sockets": {
    "sockets": [
      {
        "id": "vagina",
        "allowedTypes": ["vagina"],
        "nameTpl": "{{type}}"
      }
    ]
  }
}
```

**Clothing Slot Mapping** (from `human_female.blueprint.json`):

```json
{
  "clothingSlotMappings": {
    "torso_lower": {
      "anatomySockets": ["left_hip", "right_hip", "pubic_hair", "vagina"],
      "allowedLayers": ["underwear", "base", "outer"]
    }
  }
}
```

#### Socket Resolution Flow

1. **DirectSocketStrategy** resolves `anatomySockets` → attachment points
2. **ClothingManagementService** validates slot mappings
3. **Equipment Component** tracks actual equipped items

**Current Flow**: Socket → Attachment Points → Equipment
**Required Flow**: Socket → Covering Slots → Equipment Status

## Implementation Options Analysis

### Option 1: Direct Socket Coverage Operator (Recommended)

**Architecture**:

```javascript
class IsSocketCoveredOperator extends BaseEquipmentOperator {
  // Usage: {"isSocketCovered": ["actor", "vagina"]}
  // Logic: Socket → Find covering slots → Check equipment
}
```

**Implementation Strategy**:

1. Get anatomy blueprint for entity
2. Iterate through `clothingSlotMappings`
3. Find slots where `anatomySockets` includes target socket
4. Check if any of those slots have equipped items

**Advantages**:

- ✅ Clean, purpose-built API
- ✅ Follows existing operator patterns
- ✅ Minimal code complexity
- ✅ Efficient reverse mapping

**Disadvantages**:

- ⚠️ Requires iterating through all clothing slots (manageable scale)

### Option 2: Enhanced Socket Resolution Service

**Architecture**:

```javascript
class SocketCoverageService {
  // Centralized socket coverage logic
  // Used by multiple operators
}
```

**Advantages**:

- ✅ Reusable across multiple operators
- ✅ Centralized socket coverage logic

**Disadvantages**:

- ❌ Over-engineering for single use case
- ❌ Additional service complexity
- ❌ Not aligned with current operator patterns

### Option 3: Extend Existing Operators

**Architecture**:

```javascript
// Add socketId parameter to existing operators
{"hasClothingInSlot": ["actor", null, "vagina"]}
```

**Disadvantages**:

- ❌ Breaking API changes
- ❌ Confusing mixed semantics
- ❌ Parameter validation complexity

## Architectural Challenges & Solutions

### Challenge 1: Reverse Socket-to-Slot Mapping

**Problem**: Existing system maps slots → sockets, but we need socket → slots.

**Solution**: Iterate through clothing slot mappings to find slots that include the target socket.

```javascript
findSlotsCoveringSocket(blueprint, socketId) {
  const coveringSlots = [];
  for (const [slotName, mapping] of Object.entries(blueprint.clothingSlotMappings)) {
    if (mapping.anatomySockets?.includes(socketId)) {
      coveringSlots.push(slotName);
    }
  }
  return coveringSlots;
}
```

**Performance**: O(n) where n = number of clothing slots (~10-20), negligible impact.

### Challenge 2: Multi-Slot Socket Coverage

**Problem**: Single socket may be covered by multiple clothing slots.

**Example**: 'vagina' socket covered by both 'torso_lower' and 'underwear' slots.

**Solution**: Check if ANY covering slot has equipped items (OR logic).

```javascript
isSocketCovered(entity, socketId) {
  const coveringSlots = this.findSlotsCoveringSocket(blueprint, socketId);
  return coveringSlots.some(slotName =>
    this.hasItemsInSlot(equipmentData, slotName)
  );
}
```

### Challenge 3: Layer-Specific Coverage

**Problem**: Should coverage consider specific layers or any layer?

**Analysis**:

- **Any Layer**: More intuitive for general "is covered" queries
- **Specific Layer**: Useful for detailed coverage analysis

**Solution**: Implement "any layer" by default, provide layer-specific variant if needed.

### Challenge 4: Cross-System Integration

**Problem**: Operator needs access to anatomy blueprints and equipment data.

**Solution**: Leverage existing service dependencies in BaseEquipmentOperator:

- `entityManager` for equipment component access
- Inject anatomy services through constructor (following existing patterns)

## Detailed Implementation Design

### IsSocketCoveredOperator Class

```javascript
/**
 * @class IsSocketCoveredOperator
 * @augments BaseEquipmentOperator
 * @description Checks if a specific anatomical socket is covered by clothing
 *
 * Usage: {"isSocketCovered": ["actor", "vagina"]}
 * Returns: true if the socket is covered by any equipped clothing
 */
class IsSocketCoveredOperator extends BaseEquipmentOperator {
  #anatomyBlueprintRepository;

  constructor({ entityManager, logger, anatomyBlueprintRepository }) {
    super({ entityManager, logger }, 'isSocketCovered');
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
  }

  async evaluateInternal(entityId, params, context) {
    const [socketId] = params;

    // Get anatomy blueprint
    const blueprint = await this.#getEntityBlueprint(entityId);

    // Find slots that cover this socket
    const coveringSlots = this.#findSlotsCoveringSocket(blueprint, socketId);

    // Check if any covering slot has equipment
    const equipmentData = this.getEquipmentData(entityId);
    return coveringSlots.some((slotName) =>
      this.hasItemsInSlot(equipmentData, slotName)
    );
  }
}
```

### Registration Integration

```javascript
// In jsonLogicCustomOperators.js
const isSocketCoveredOp = new IsSocketCoveredOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
  anatomyBlueprintRepository: this.#anatomyBlueprintRepository,
});

jsonLogicEvaluationService.addOperation(
  'isSocketCovered',
  function (entityPath, socketId) {
    return isSocketCoveredOp.evaluate([entityPath, socketId], this);
  }
);
```

## Performance Considerations

### Computational Complexity

**Socket Resolution**: O(n) where n = clothing slots per blueprint (~10-20)
**Equipment Lookup**: O(1) component access
**Overall**: O(n) per query, negligible for interactive use

### Caching Opportunities

1. **Blueprint Caching**: Already implemented in `AnatomyBlueprintRepository`
2. **Socket Mapping Cache**: Could pre-compute socket → slots mapping
3. **Equipment Caching**: Already implemented in anatomy caches

### Memory Usage

**Additional Memory**: Minimal, reuses existing data structures
**Cache Impact**: Negligible, socket mappings are small data sets

## Error Handling Strategy

### Input Validation

```javascript
// Socket ID validation
if (!socketId || typeof socketId !== 'string') {
  this.logger.warn(`Invalid socketId parameter: ${socketId}`);
  return false;
}

// Entity validation (inherited from BaseEquipmentOperator)
// Blueprint validation
if (!blueprint?.clothingSlotMappings) {
  this.logger.warn(`No clothing slot mappings for entity ${entityId}`);
  return false;
}
```

### Graceful Degradation

**Missing Blueprint**: Return false, log warning
**Missing Equipment Component**: Return false (not covered)
**Empty Socket Mappings**: Return false (no coverage possible)

## Testing Strategy

### Unit Tests

```javascript
describe('IsSocketCoveredOperator', () => {
  describe('Socket Coverage Detection', () => {
    it('should return true when socket is covered by equipped clothing');
    it('should return false when socket is not covered');
    it('should handle multiple slots covering same socket');
    it('should handle non-existent sockets gracefully');
  });

  describe('Integration with Equipment System', () => {
    it('should work with actual anatomy blueprints');
    it('should respect clothing layer structure');
  });
});
```

### Integration Tests

```javascript
describe('Socket Coverage Integration', () => {
  it('should detect vagina coverage in female anatomy');
  it('should detect penis coverage in male anatomy');
  it('should work with complex clothing combinations');
});
```

## Security Considerations

### Input Sanitization

**Socket ID Injection**: String validation prevents injection attacks
**Entity Path Validation**: Inherited from BaseEquipmentOperator
**Blueprint Validation**: Schema validation in repository layer

### Access Control

**Component Access**: Respects existing entity manager security
**Blueprint Access**: Uses existing repository access controls

## Extension Possibilities

### Future Enhancements

1. **Layer-Specific Coverage**: `isSocketCoveredInLayer(socketId, layerName)`
2. **Partial Coverage**: Calculate coverage percentage
3. **Coverage Metadata**: Return covering item details
4. **Batch Queries**: Check multiple sockets efficiently

### API Evolution

**Current**: `{"isSocketCovered": ["actor", "vagina"]}`
**Extended**: `{"isSocketCovered": ["actor", "vagina", {"layer": "underwear"}]}`

## Dependencies & Integration Points

### Required Dependencies

```javascript
// Constructor dependencies
{
  entityManager: 'IEntityManager',
  logger: 'ILogger',
  anatomyBlueprintRepository: 'IAnatomyBlueprintRepository'
}
```

### Service Integration

**ClothingManagementService**: Provides blueprint access patterns
**DirectSocketStrategy**: Provides socket resolution patterns
**BaseEquipmentOperator**: Provides equipment access patterns

## Risk Assessment

### Implementation Risks

**Low Risk**:

- ✅ Well-defined requirements
- ✅ Existing architectural patterns
- ✅ Comprehensive test coverage planned

**Medium Risk**:

- ⚠️ Blueprint access dependency (mitigated by existing patterns)
- ⚠️ Performance with complex anatomies (mitigated by caching)

**Mitigation Strategies**:

- Follow existing operator patterns exactly
- Leverage existing caching infrastructure
- Comprehensive testing across anatomy types

## Conclusion

The `isSocketCovered` operator can be implemented efficiently within the existing Living Narrative Engine architecture. The clothing system's `anatomySockets` mappings provide the necessary infrastructure for reverse socket-to-slot mapping.

**Implementation Approach**:

1. **Minimal Architecture Changes**: Extends existing operator patterns
2. **Efficient Logic**: O(n) reverse mapping with caching support
3. **Robust Error Handling**: Follows established patterns
4. **Future-Proof Design**: Extensible for additional coverage queries

**Key Benefits**:

- Clean, intuitive API for socket coverage queries
- Leverages existing clothing system infrastructure
- Maintains architectural consistency
- Provides foundation for enhanced coverage features

The implementation requires creating one new operator class and updating the operator registration, making it a low-risk, high-value addition to the clothing system.

---

**Report Generated**: 2025-01-19  
**Analysis Depth**: Comprehensive architectural and implementation review  
**Confidence Level**: High - Based on detailed code analysis and architectural assessment
