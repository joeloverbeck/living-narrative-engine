# MOVMODMIG-003: Dependency Analysis and Impact Assessment

## Overview
Perform comprehensive analysis of all dependencies and cross-references for movement-related components. Identify all files that reference movement components and assess the impact of namespace changes.

## Current State
- **Core Mod**: Contains movement components with `core:` namespace
- **Positioning Mod**: References `core:actor-can-move` in 2 actions
- **Follow Action**: References `core:actor-can-move` as prerequisite
- **Unknown Dependencies**: Potential references in other mods or systems

## Objectives
1. Map all direct and transitive dependencies for movement components
2. Identify all files requiring namespace updates
3. Create compatibility matrix for phased migration
4. Assess risk levels for each component migration
5. Design compatibility layer for backward compatibility

## Technical Requirements

### Dependency Scanner Script
```javascript
// Location: scripts/analyze-movement-dependencies.js
const fs = require('fs');
const path = require('path');

class DependencyAnalyzer {
  constructor() {
    this.dependencies = new Map();
    this.references = new Map();
  }

  analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const movementPatterns = [
      /core:go/g,
      /core:actor-can-move/g,
      /core:exit-is-unblocked/g,
      /core:clear_directions/g,
      /core:event-is-action-go/g,
      /handle_go_action/g
    ];

    movementPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        this.recordDependency(filePath, pattern.source, matches.length);
      }
    });
  }

  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      dependencies: Object.fromEntries(this.dependencies),
      references: Object.fromEntries(this.references),
      impactedFiles: this.getImpactedFiles()
    };
  }
}
```

### Dependency Matrix Format
```json
// Location: docs/migrations/movement-dependency-matrix.json
{
  "analysisDate": "2024-01-XX",
  "components": {
    "core:go": {
      "type": "action",
      "references": [
        "core:clear_directions",
        "core:actor-can-move"
      ],
      "referencedBy": [],
      "migrationImpact": "low",
      "requiresCompatibility": false
    },
    "core:actor-can-move": {
      "type": "condition",
      "references": [],
      "referencedBy": [
        "core:go",
        "core:follow",
        "positioning:turn_around",
        "positioning:get_close"
      ],
      "migrationImpact": "high",
      "requiresCompatibility": true
    },
    "core:exit-is-unblocked": {
      "type": "condition",
      "references": [],
      "referencedBy": [
        "core:clear_directions"
      ],
      "migrationImpact": "low",
      "requiresCompatibility": false
    },
    "core:clear_directions": {
      "type": "scope",
      "references": [
        "core:exit-is-unblocked"
      ],
      "referencedBy": [
        "core:go"
      ],
      "migrationImpact": "low",
      "requiresCompatibility": false
    },
    "core:event-is-action-go": {
      "type": "condition",
      "references": [],
      "referencedBy": [
        "handle_go_action"
      ],
      "migrationImpact": "low",
      "requiresCompatibility": false
    }
  }
}
```

## Implementation Steps

### Step 1: Scan All Mod Files
```bash
# Find all JSON and scope files in mods directory
find data/mods -type f \( -name "*.json" -o -name "*.scope" \) > files-to-scan.txt

# Count total files to analyze
wc -l files-to-scan.txt
```

### Step 2: Execute Dependency Analysis
```bash
# Run dependency analyzer
node scripts/analyze-movement-dependencies.js

# Generate detailed report
node scripts/analyze-movement-dependencies.js --output=reports/movement-dependencies.json
```

### Step 3: Identify Impact Categories
```javascript
// Impact categorization logic
const categorizeImpact = (component) => {
  const referenceCount = component.referencedBy.length;
  const crossModReferences = component.referencedBy.filter(ref =>
    !ref.startsWith('core:')
  ).length;

  if (crossModReferences > 0) return 'high';
  if (referenceCount > 2) return 'medium';
  return 'low';
};
```

### Step 4: Create Compatibility Layer Design
```json
// Location: data/mods/core/compatibility/movement-aliases.json
{
  "version": "1.0.0",
  "description": "Temporary aliases for migrated movement components",
  "aliases": {
    "core:go": {
      "target": "movement:go",
      "deprecationWarning": "core:go is deprecated, use movement:go",
      "removeInVersion": "2.0.0"
    },
    "core:actor-can-move": {
      "target": "movement:actor-can-move",
      "deprecationWarning": "core:actor-can-move is deprecated, use movement:actor-can-move",
      "removeInVersion": "2.0.0"
    },
    "core:exit-is-unblocked": {
      "target": "movement:exit-is-unblocked",
      "deprecationWarning": "core:exit-is-unblocked is deprecated, use movement:exit-is-unblocked",
      "removeInVersion": "2.0.0"
    },
    "core:clear_directions": {
      "target": "movement:clear_directions",
      "deprecationWarning": "core:clear_directions is deprecated, use movement:clear_directions",
      "removeInVersion": "2.0.0"
    },
    "core:event-is-action-go": {
      "target": "movement:event-is-action-go",
      "deprecationWarning": "core:event-is-action-go is deprecated, use movement:event-is-action-go",
      "removeInVersion": "2.0.0"
    }
  }
}
```

### Step 5: Generate Impact Report
```markdown
// Location: reports/movement-migration-impact.md
# Movement Migration Impact Assessment

## Executive Summary
- **Total Components**: 6
- **High Impact**: 1 (core:actor-can-move)
- **Medium Impact**: 0
- **Low Impact**: 5

## High Impact Components

### core:actor-can-move
- **Referenced By**: 4 components across 2 mods
- **Cross-Mod References**: 2 (positioning mod)
- **Risk**: Breaking changes if not handled properly
- **Mitigation**: Implement compatibility alias

## Files Requiring Updates

### Core Mod
1. `actions/follow.action.json`
   - Update: `core:actor-can-move` → `movement:actor-can-move`

### Positioning Mod
1. `actions/turn_around.action.json`
   - Update: `core:actor-can-move` → `movement:actor-can-move`
2. `actions/get_close.action.json`
   - Update: `core:actor-can-move` → `movement:actor-can-move`

## Migration Phases

### Phase 1: Parallel Deployment
- Deploy movement mod with new components
- Keep core components active
- Implement compatibility layer

### Phase 2: Reference Updates
- Update all internal core references
- Update positioning mod references
- Test thoroughly

### Phase 3: Cleanup
- Remove core movement components
- Remove compatibility aliases
- Final validation
```

### Step 6: Create Reference Update Script
```javascript
// Location: scripts/update-movement-references.js
const fs = require('fs');
const path = require('path');

const updateReferences = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  const replacements = [
    ['core:go', 'movement:go'],
    ['core:actor-can-move', 'movement:actor-can-move'],
    ['core:exit-is-unblocked', 'movement:exit-is-unblocked'],
    ['core:clear_directions', 'movement:clear_directions'],
    ['core:event-is-action-go', 'movement:event-is-action-go']
  ];

  replacements.forEach(([oldRef, newRef]) => {
    if (content.includes(oldRef)) {
      content = content.replace(new RegExp(oldRef, 'g'), newRef);
      modified = true;
      console.log(`Updated ${oldRef} → ${newRef} in ${filePath}`);
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
  }

  return modified;
};
```

## Validation Criteria

### Analysis Completeness
- [ ] All mod files scanned for dependencies
- [ ] Dependency matrix complete and accurate
- [ ] Impact assessment covers all components
- [ ] Cross-mod dependencies identified

### Compatibility Planning
- [ ] Compatibility layer design complete
- [ ] Deprecation warnings defined
- [ ] Version constraints specified
- [ ] Rollback procedures documented

### Documentation Quality
- [ ] Impact report comprehensive
- [ ] Migration phases clearly defined
- [ ] Risk assessment complete
- [ ] Update scripts functional

## Testing Requirements

### Dependency Analysis Tests
```javascript
// Location: tests/unit/migrations/dependencyAnalysis.test.js
describe('Movement Dependency Analysis', () => {
  it('should identify all movement component references', () => {
    // Test pattern matching for all components
  });

  it('should categorize impact levels correctly', () => {
    // Test impact categorization logic
  });

  it('should generate accurate dependency matrix', () => {
    // Verify matrix completeness
  });
});
```

### Compatibility Layer Tests
```javascript
// Location: tests/integration/migrations/compatibilityLayer.test.js
describe('Movement Compatibility Layer', () => {
  it('should redirect old references to new namespace', () => {
    // Test alias functionality
  });

  it('should log deprecation warnings', () => {
    // Verify warning messages
  });

  it('should maintain backward compatibility', () => {
    // Test that old references still work
  });
});
```

## Risk Assessment

### Risks
1. **Hidden Dependencies**: Some references might be in dynamic strings
2. **Circular Dependencies**: Components might have circular references
3. **Third-Party Mods**: Unknown mods might reference movement components
4. **Performance Impact**: Compatibility layer might slow loading

### Mitigation
1. Use comprehensive regex patterns and manual review
2. Analyze dependency graph for cycles
3. Provide migration guide for mod developers
4. Implement efficient alias resolution

## Dependencies
- **Requires**: MOVMODMIG-001, MOVMODMIG-002
- **Enables**: MOVMODMIG-004, MOVMODMIG-005, MOVMODMIG-006, MOVMODMIG-007

## Estimated Effort
**Story Points**: 5
**Time Estimate**: 3-4 hours

## Acceptance Criteria
- [ ] Complete dependency matrix generated
- [ ] All cross-mod references identified
- [ ] Impact assessment documented for each component
- [ ] Compatibility layer designed and documented
- [ ] Reference update script created and tested
- [ ] Migration phases clearly defined
- [ ] Risk mitigation strategies documented
- [ ] All analysis results saved in reports directory

## Notes
- Pay special attention to `core:actor-can-move` due to high impact
- Consider creating automated dependency tracking for future migrations
- The compatibility layer is crucial for smooth transition
- Document any dynamic references that can't be automatically detected