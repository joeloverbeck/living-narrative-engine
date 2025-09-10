# Mod Dependency Validation System Implementation Analysis

## Executive Summary

This report analyzes the implementation requirements for a mod dependency validation system in the Living Narrative Engine. The system is needed to prevent higher-level mods from referencing lower-level mods without proper dependency declarations, ensuring clean mod architecture and reliable loading order.

## Problem Statement

### Current Violation Case

The `positioning` mod (data/mods/positioning/) currently references `intimacy:kissing` component in its `turn_around.action.json` file:

```json
"forbidden_components": {
  "actor": ["intimacy:kissing"]
}
```

However, `positioning` mod's manifest declares only `core` as a dependency:

```json
"dependencies": [
  {
    "id": "core",
    "version": "^1.0.0"
  }
]
```

Meanwhile, `intimacy` mod correctly declares `positioning` as a dependency:

```json
"dependencies": [
  {
    "id": "anatomy",
    "version": "^1.0.0"
  },
  {
    "id": "positioning",
    "version": "^1.0.0"
  }
]
```

### Architectural Impact

This creates several issues:

1. **Hidden Dependencies**: The `positioning` mod has an undeclared dependency on `intimacy`
2. **Loading Order Problems**: Mod loading may fail if `intimacy` isn't loaded before `positioning`
3. **Modularity Violations**: Higher-level mods shouldn't reference lower-level components
4. **Maintenance Complexity**: Dependency relationships become unclear and hard to track

## Current Mod Architecture Analysis

### Mod Hierarchy (Based on Dependencies)

```
core (foundation)
├── anatomy
├── descriptors
├── positioning
└── clothing

Level 2 (depends on Level 1):
├── intimacy (→ anatomy, positioning)
├── violence (→ positioning, anatomy)
└── sex (→ anatomy, positioning, intimacy)

Level 3 (complex dependencies):
├── exercise (→ positioning, anatomy)
└── examples (→ core variations)

Specialized:
└── isekai (world definitions)
```

### Reference Pattern Analysis

Namespaced references follow the pattern `modId:identifier`:

- **Core references**: `core:actor`, `core:position` (always valid)
- **Cross-mod references**: `positioning:closeness`, `intimacy:kissing`
- **Component references**: Found in actions, conditions, rules, scopes
- **Scope DSL references**: `actor.components.positioning:closeness`

### Files Requiring Validation

1. **Actions** (`*.action.json`): `required_components`, `forbidden_components`, `targets.scope`
2. **Conditions** (`*.condition.json`): JSON Logic expressions with mod references
3. **Rules** (`*.rule.json`): `condition_ref`, component operations
4. **Scopes** (`*.scope`): Scope DSL expressions with component access
5. **Components** (`*.component.json`): Component definitions and references
6. **Events** (`*.event.json`): Event definitions and payload schemas

## Proposed Implementation Architecture

### Current Infrastructure Assessment

**CRITICAL UPDATE**: The codebase already contains substantial mod validation infrastructure:

- **`src/modding/modDependencyValidator.js`**: Full dependency/conflict validation with semver support
- **`src/modding/modLoadOrderResolver.js`**: Dependency-aware load order resolution using topological sort
- **`src/modding/modManifestLoader.js`**: Manifest loading and processing
- **`src/validation/`**: Contains 6 specialized validators following established patterns

**Implementation Strategy**: Extend existing validation infrastructure rather than building from scratch.

### 1. Reference Extraction System

**Location**: `src/validation/modReferenceExtractor.js`

**Integration Approach**: Follow patterns from existing validators like `ajvSchemaValidator.js` and `eventValidationService.js`

**Responsibilities**:

- Traverse mod directory structure
- Parse different file types (JSON, Scope DSL)
- Extract all namespaced references (`modId:*` patterns)
- Handle complex patterns (JSON Logic, Scope DSL)
- **NEW**: Integrate with existing validation pipeline

**Key Features**:

```javascript
class ModReferenceExtractor {
  constructor({ logger, ajvValidator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
    this.#ajvValidator = ajvValidator;
  }

  async extractReferences(modPath) {
    // Returns: { modId: Set<string> }
    // Example: { "intimacy": Set(["kissing"]), "core": Set(["actor"]) }
  }

  extractFromAction(actionData) {
    /* ... */
  }
  extractFromCondition(conditionData) {
    /* ... */
  }
  extractFromRule(ruleData) {
    /* ... */
  }
  extractFromScope(scopeContent) {
    /* ... */
  }
  extractFromComponent(componentData) {
    /* ... */
  }
}
```

**Extraction Patterns** (Updated based on codebase analysis):

1. **JSON Property Values**: Direct string scanning for `modId:componentId` patterns
2. **JSON Logic Conditions**: Recursive traversal of logic trees
3. **Scope DSL Files (.scope)**: **CRITICAL**: Complex syntax parsing required:
   - Example: `positioning:close_actors_facing_each_other_or_behind_target := actor.components.positioning:closeness.partners`
   - Pattern: `modId:scopeId := entity.components.modId:componentId.field`
   - Requires dedicated parser beyond simple regex matching
4. **Array Elements**: Component lists, scope references in actions/rules
5. **Nested Objects**: Complex rule structures with operation handlers
6. **Condition References**: `condition_ref` properties linking to other mods
7. **Target Scopes**: Action target scopes referencing other mod scopes

### 2. Cross-Reference Validation System

**Location**: `src/validation/modCrossReferenceValidator.js`

**ARCHITECTURE UPDATE**: Work alongside existing `src/modding/modDependencyValidator.js` rather than replacing it.

**Integration Strategy**:

- Extend existing `ModDependencyValidator` patterns
- Use existing dependency resolution infrastructure
- Follow established error handling patterns

**Responsibilities**:

- Cross-reference extracted mod references with dependency declarations
- Generate detailed violation reports compatible with existing error formats
- Integrate with current mod loading pipeline
- Work with existing `ModLoadOrderResolver`

**Key Features**:

```javascript
class ModCrossReferenceValidator {
  constructor({ logger, modDependencyValidator, referenceExtractor }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
    this.#modDependencyValidator = modDependencyValidator;
    this.#referenceExtractor = referenceExtractor;
  }

  async validateModReferences(modPath, manifestsMap) {
    // Returns validation report with cross-reference violations
  }

  async validateAllModReferences(manifestsMap) {
    // Validates entire mod ecosystem for cross-reference violations
  }

  generateReport(violations) {
    // Creates human-readable violation report using existing patterns
  }
}
```

**Validation Rules**:

1. **Core Dependency**: Always implicit, never needs declaration
2. **Self References**: `modId:*` references within same mod are valid
3. **Declared Dependencies**: Must match manifest dependency list
4. **Circular Dependencies**: Detect and report circular references
5. **Version Compatibility**: Optional future enhancement

### 3. Integration with Update Manifest

**Location**: Extend `scripts/updateManifest.js` (582 lines of sophisticated scanning logic)

**ARCHITECTURE UPDATE**: The existing manifest update script is far more complex than initially assessed, with:

- Recursive directory scanning for multiple file types
- Special handling for entities, scopes, blueprints, recipes
- Advanced error handling and reporting
- Batch processing capabilities

**Integration Strategy**:

1. **Pre-Processing Phase**: Add validation before existing content scanning begins
2. **Fail-Fast Approach**: Stop manifest update if violations found
3. **Detailed Error Reporting**: Show exact file and line of violations
4. **Backward Compatibility**: Add opt-in flag to avoid breaking existing workflows
5. **Leverage Existing Infrastructure**: Use current error handling and reporting patterns

**Implementation Approach**:

```javascript
// In updateManifest.js - enhance existing function
async function updateModManifest(modName, options = {}) {
  console.log(`Starting manifest update for mod: "${modName}"`);

  const modPath = path.join(MODS_BASE_PATH, modName);
  const manifestPath = path.join(modPath, MANIFEST_FILENAME);

  // NEW: Pre-validation step (opt-in via options.validateReferences)
  if (options.validateReferences) {
    try {
      const validator = new ModCrossReferenceValidator({
        /* dependencies */
      });
      const validation = await validator.validateModReferences(
        modPath,
        manifestsMap
      );

      if (validation.hasViolations) {
        console.error(
          `❌ Cross-reference validation failed for mod "${modName}"`
        );
        console.error(validation.report);
        return {
          success: false,
          modName,
          error: {
            type: 'CROSS_REFERENCE_VIOLATION',
            message: validation.report,
            path: modPath,
          },
        };
      }
    } catch (error) {
      // Handle validation errors using existing error handling patterns
      return {
        success: false,
        modName,
        error: {
          type: 'VALIDATION_ERROR',
          message: error.message,
          path: modPath,
        },
      };
    }
  }

  // Continue with existing manifest update logic...
}
```

### 4. Validation Report Structure

**Violation Report Format**:

```javascript
{
  modId: "positioning",
  hasViolations: true,
  violations: [
    {
      file: "actions/turn_around.action.json",
      line: 17,
      referencedMod: "intimacy",
      referencedComponent: "kissing",
      context: "forbidden_components.actor",
      message: "Mod 'positioning' references 'intimacy:kissing' but doesn't declare 'intimacy' as a dependency"
    }
  ],
  declaredDependencies: ["core"],
  referencedMods: ["core", "intimacy"],
  missingDependencies: ["intimacy"]
}
```

## Implementation Phases (REVISED)

### Phase 1: Reference Extraction Enhancement (Week 1)

**Deliverables**:

- `ModReferenceExtractor` class integrated with existing validation infrastructure
- Unit tests following existing test patterns in `/tests/common/`
- Support for actions, conditions, rules, components, events (JSON files)
- Integration with existing `AjvSchemaValidator` patterns

**Success Criteria**:

- Extract all mod references from positioning mod JSON files
- Identify the intimacy violation case in `turn_around.action.json`
- 90%+ test coverage using existing test utilities
- Zero impact on existing validation performance

### Phase 2: Scope DSL Integration (Week 2)

**Deliverables**:

- Scope DSL parsing support for `.scope` files
- Handle complex syntax: `modId:scopeId := entity.components.modId:componentId`
- JSON Logic condition traversal enhancement
- Integration with existing scope resolution system

**Success Criteria**:

- Parse all file types in intimacy and positioning mods
- Extract complex scope expressions from `.scope` files
- Handle nested JSON structures and condition references
- Maintain compatibility with existing scope loading

### Phase 3: Cross-Reference Validation Integration (Week 3)

**Deliverables**:

- `ModCrossReferenceValidator` class working alongside existing `ModDependencyValidator`
- Violation detection and reporting compatible with existing error handling
- Integration with current mod loading pipeline
- Enhanced validation reports

**Success Criteria**:

- Detect positioning → intimacy violation using existing dependency data
- Generate detailed error reports using established error patterns
- Validate all existing mods with zero false positives
- Seamless integration with existing `ModLoadOrderResolver`

### Phase 4: UpdateManifest Integration & Testing (Week 4)

**Deliverables**:

- Integration with existing `updateManifest.js` workflow (582 lines)
- Comprehensive test suite leveraging existing test infrastructure
- Backward compatibility with opt-in validation flag
- Documentation following existing patterns

**Success Criteria**:

- `npm run update-manifest --validate-references` fails on violations
- Existing `npm run update-manifest` continues to work unchanged
- Clear error messages compatible with current output format
- Performance impact <500ms for large mods
- Zero false positives on current valid mod ecosystem

## Technical Considerations

### File Type Handling (Updated based on codebase discovery)

1. **JSON Files**: Standard JSON.parse() with recursive traversal for:
   - Actions (`.action.json`) - `required_components`, `forbidden_components`, `targets.scope`
   - Rules (`.rule.json`) - `condition_ref`, operation handlers with component operations
   - Conditions (`.condition.json`) - JSON Logic expressions with mod references
   - Components (`.component.json`) - Component definitions with cross-mod dependencies
   - Events (`.event.json`) - Event definitions with mod-specific payloads
2. **Scope Files (.scope)**: **COMPLEX** - Custom parser for DSL syntax patterns:
   - Pattern: `modId:scopeId := actor.components.modId:componentId.field[conditions]`
   - Requires understanding existing scope resolution infrastructure
   - Integration with current `src/scopeDsl/` parsing system
3. **Binary Files**: Skip non-text files safely
4. **Large Files**: Stream processing for performance, following existing `updateManifest.js` patterns
5. **Blueprint Files (`.blueprint.json`)**: Anatomy system references requiring specialized parsing
6. **Recipe Files (`.recipe.json`)**: Anatomy recipe files with potential cross-mod references

### Performance Optimization

1. **Caching**: Cache parsed manifests and extracted references
2. **Parallel Processing**: Validate multiple mods concurrently
3. **Incremental Updates**: Only re-validate changed files
4. **Memory Management**: Release resources after validation

### Error Handling (Following Existing Patterns)

**Use Established Error Infrastructure**:

- `ModDependencyError` from `src/errors/modDependencyError.js`
- Error handling patterns from existing `ModDependencyValidator`
- Logging patterns from existing validation services

1. **Parse Errors**: Follow existing JSON parsing error handling from `updateManifest.js`
2. **File Access**: Use existing file access patterns with proper error categorization
3. **Validation Errors**: Integrate with existing error classification system
4. **Recovery Strategies**: Follow existing fail-fast vs. warning patterns from `ModDependencyValidator`

**Error Categories** (consistent with existing infrastructure):

```javascript
// Follow existing ModDependencyError pattern
class CrossReferenceViolationError extends ModDependencyError {
  constructor(violations) {
    super(`Cross-reference violations detected:\n${violations.join('\n')}`);
    this.name = 'CrossReferenceViolationError';
    this.violations = violations;
  }
}
```

## Recommended Resolution Strategy

### Immediate Fix for Current Violation

The `positioning` mod should not reference `intimacy` components. Recommended approaches:

1. **Remove Reference**: Delete the `intimacy:kissing` reference from `turn_around.action.json`
2. **Create Abstraction**: Define a generic "engaged" component in `positioning`
3. **Reverse Dependency**: Move the constraint to `intimacy` mod rules

### Long-term Architecture Improvements

1. **Interface Segregation**: Define clear mod interfaces and contracts
2. **Event-Driven Communication**: Use events instead of direct component references
3. **Dependency Injection**: Register mod services for cross-mod communication
4. **Version Management**: Implement semantic versioning for mod compatibility

## Testing Strategy

### Unit Tests

1. **Reference Extraction**: Test pattern matching for each file type
2. **Validation Logic**: Test dependency checking algorithms
3. **Error Handling**: Test malformed input handling
4. **Performance**: Test with large mod structures

### Integration Tests

1. **End-to-End Validation**: Test complete validation workflow
2. **Manifest Integration**: Test update-manifest script integration
3. **Multi-Mod Scenarios**: Test complex dependency graphs
4. **Error Reporting**: Test user-facing error messages

### Test Data

1. **Valid Mods**: Mods with correct dependencies
2. **Violation Cases**: Mods with various violation types
3. **Edge Cases**: Circular dependencies, self-references
4. **Performance Cases**: Large mods with many references

## Security Considerations

### Input Validation

1. **Path Traversal**: Prevent access outside mod directories
2. **File Type Validation**: Only process expected file types
3. **Content Sanitization**: Safely parse user-provided JSON
4. **Resource Limits**: Prevent excessive memory/CPU usage

### Error Information Disclosure

1. **Sensitive Paths**: Don't expose full system paths in errors
2. **Stack Traces**: Limit internal implementation details
3. **User Data**: Don't log sensitive mod content
4. **Validation Reports**: Sanitize file paths and content

## Success Metrics

### Functional Metrics

1. **Violation Detection**: 100% detection rate for dependency violations
2. **False Positive Rate**: <1% false positives on valid mods
3. **Performance**: <2 seconds validation time for large mods
4. **Coverage**: Support for all mod file types

### Quality Metrics

1. **Test Coverage**: >90% line and branch coverage
2. **Documentation**: Complete API documentation and examples
3. **Error Messages**: Clear, actionable error descriptions
4. **Maintainability**: Clean, well-structured code

## Future Enhancements (Building on existing infrastructure)

### Version 2.0 Features (Many already implemented)

1. **Dependency Resolution**: **ALREADY IMPLEMENTED** - `ModLoadOrderResolver` with topological sort
2. **Version Constraints**: **ALREADY IMPLEMENTED** - Full semver support in `ModDependencyValidator`
3. **Hot Reloading**: Live validation during development (could integrate with existing dev server)
4. **IDE Integration**: VS Code extension for real-time validation (could build on existing JSON schema validation)

### Advanced Capabilities (Potential future work)

1. **Enhanced Static Analysis**: Deeper cross-mod interaction analysis beyond reference validation
2. **Performance Profiling**: **PARTIALLY EXISTS** - existing performance monitoring infrastructure could be extended
3. **Compatibility Matrix**: Build on existing dependency and version validation
4. **Migration Tools**: Automated dependency migration assistance using existing manifest processing
5. **Scope DSL Validation**: **FOUNDATION EXISTS** - extensive scope parsing infrastructure could be enhanced
6. **Component Interface Validation**: Validate that referenced components actually exist and have expected schemas

## Conclusion

The mod dependency validation system will significantly improve the Living Narrative Engine's modularity and reliability. By preventing invalid cross-mod references, the system ensures clean architecture and predictable loading behavior.

The implementation should be rolled out in phases, starting with the current violation case and expanding to comprehensive validation. Integration with the existing `update-manifest` workflow provides a natural enforcement point that prevents future violations.

This system will establish a foundation for more sophisticated mod management features while maintaining backward compatibility with the existing mod ecosystem.
