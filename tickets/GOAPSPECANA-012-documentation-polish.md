# GOAPSPECANA-012: Documentation Polish and Finalization

**Status**: Not Started
**Priority**: MEDIUM
**Estimated Effort**: 2-3 days
**Dependencies**: GOAPSPECANA-001 through GOAPSPECANA-011 (all critical and major issues resolved)
**Blocks**: Final specification release

## Problem Statement

After resolving all critical and major issues, specification needs professional polish:
- Passive voice hides responsibility ("we ensure" → who?)
- Preferences stated as requirements ("I prefer")
- Uncertainty in specification ("I think")
- Missing phasing strategy (MVP vs Phase 2)
- No observability/debugging strategy
- Incomplete navigation and cross-references

## Objective

Transform specification into professional, unambiguous, production-ready document with clear ownership, requirements language, phasing strategy, and comprehensive navigation.

## Acceptance Criteria

- [ ] All passive voice replaced with clear ownership
- [ ] All preferences converted to firm requirements
- [ ] All uncertainty removed
- [ ] Phasing strategy defined (MVP → Phase 2 → Phase 3)
- [ ] Observability and debugging strategy specified
- [ ] Architecture diagrams added
- [ ] Table of contents and cross-references complete
- [ ] RFC 2119 keywords used correctly (MUST, SHALL, SHOULD, MAY)

## Tasks

### 1. Language Precision Cleanup

**Passive Voice Fixes (lines 139-140)**:
```
Before: "we ensure that all visible entities... include..."
After: "KnowledgeManager SHALL ensure that all visible entities..."
OR: "TurnInitializer SHALL invoke KnowledgeManager.updateVisibility(actor)"
```

**Preference to Requirement (lines 91-93)**:
```
Before: "Note: I'd prefer to keep this refinement / concretization fully data-driven"
After: "Refinement MUST be data-driven using HTN methods."
OR: "Phase 1 MAY use code-based refinement. Phase 2 MUST migrate to HTN methods."
```

**Remove Uncertainty (line 137)**:
```
Before: "I think the scopeDsl is currently limited for this"
After: "scopeDsl currently does not support world-wide queries. Section 4.2 specifies required extensions."
```

**RFC 2119 Keywords Review**:
- [ ] Search for informal language: "should", "could", "might", "probably"
- [ ] Replace with RFC 2119 keywords:
  - MUST / REQUIRED / SHALL: Absolute requirement
  - MUST NOT / SHALL NOT: Absolute prohibition
  - SHOULD / RECOMMENDED: Strong guideline
  - SHOULD NOT / NOT RECOMMENDED: Strong warning
  - MAY / OPTIONAL: Truly optional
- [ ] Ensure consistent usage throughout

### 2. Phasing Strategy Definition

**Define MVP (Phase 1)**:
```markdown
## Phasing and Implementation Roadmap

### Phase 1: MVP (Minimum Viable Product)
**Timeline**: 8-12 weeks
**Goal**: Basic GOAP system with single-actor planning

Features:
- ✅ Task loading from mods
- ✅ Structural gates evaluation
- ✅ Simple planning (A* or forward search)
- ✅ Basic refinement (chosen approach from GOAPSPECANA-001)
- ✅ Single-actor planning (no concurrency)
- ✅ Basic knowledge system (simplified if needed)
- ✅ Plan execution and invalidation
- ✅ 3-5 example tasks (consume, heal, move)

Success Criteria:
- NPCs can plan and execute simple goals
- Planning completes within performance targets
- No state corruption
- 80% test coverage
```

**Define Phase 2**:
```markdown
### Phase 2: Advanced Features
**Timeline**: +8-12 weeks
**Goal**: Multi-actor coordination and advanced planning

Features:
- ✅ Concurrent planning (multiple actors)
- ✅ Resource conflict resolution
- ✅ Advanced knowledge system (if not in Phase 1)
- ✅ Plan caching and reuse
- ✅ HTN methods (if code-based used in Phase 1)
- ✅ Advanced structural gates
- ✅ Performance optimizations

Success Criteria:
- 50 concurrent actors supported
- Minimal plan interference
- Resource conflicts resolved gracefully
```

**Define Phase 3**:
```markdown
### Phase 3: Production Hardening
**Timeline**: +4-8 weeks
**Goal**: Production-ready robustness and observability

Features:
- ✅ Advanced failure recovery
- ✅ Comprehensive observability
- ✅ Performance tuning
- ✅ Extensive testing (100+ scenarios)
- ✅ Debugging tools
- ✅ Modder documentation
```

### 3. Observability and Debugging Strategy

```markdown
## Observability and Debugging

### Logging Requirements
- Planning decisions: Goal selected, task library size, plan found/failed
- Refinement: Input task, output actions, failure reasons
- Execution: Actions executed, preconditions checked, invalidations
- Performance: Planning time, memory usage, cache hits
- Errors: Exceptions, validation failures, timeout events

Log Levels:
- DEBUG: Detailed planning steps, state snapshots
- INFO: Goal selection, plan execution, refinement results
- WARN: Plan invalidations, repeated failures, performance warnings
- ERROR: Exceptions, critical failures, state corruption

### Performance Monitoring
Metrics to track:
- Planning time (mean, p95, p99) by task count
- Memory overhead per actor
- Plan success rate by scenario type
- Replan frequency
- Goal abandonment rate

### Debugging Tools
- Plan visualizer: Show planning search tree
- State inspector: Inspect world state snapshot
- Task library viewer: See which tasks included/excluded
- Refinement tracer: Step through refinement logic
- Timeline view: Visualize multi-actor interactions

### Development Mode Features
- Verbose logging (all planning steps)
- Plan validation (catch bugs early)
- Performance assertions (fail if targets exceeded)
- State diff tracking (detect mutations)
```

### 4. Architecture Diagrams

Create diagrams for:

**Diagram 1: System Overview**
```
+----------------+     +------------------+     +------------------+
|   Game World   |<--->|  GOAP Planner    |<--->| Task Library     |
| (Entity/Comp)  |     | (Goal→Plan)      |     | (Loaded from mods|
+----------------+     +------------------+     +------------------+
        ↑                       ↑                        ↑
        |                       |                        |
        v                       v                        v
+----------------+     +------------------+     +------------------+
| Execution Sys  |     | Refinement Layer |     | Knowledge System |
| (Run Actions)  |     | (Task→Actions)   |     | (Known Entities) |
+----------------+     +------------------+     +------------------+
```

**Diagram 2: Planning Flow**
```
Goal Selection → Task Library Building → GOAP Search → Plan Validation
       ↓                   ↓                   ↓              ↓
   (Relevant?         (Gates Pass?        (Valid Path?    (Achievable?
    Priority)          Knowledge)          to Goal)         Complete)
                                                               ↓
                                                          Valid Plan
```

**Diagram 3: Refinement to Execution**
```
Planning Task (Abstract) → Refinement → Primitive Actions → Execution
   consume_item(apple)       ↓            [consume(apple)]      ↓
                        Check inventory                   Update State
                        Generate steps                    Check Success
                        Return sequence                   Invalidate if needed
```

**Diagram 4: Knowledge System**
```
Turn Start → Visibility Check → Update known_to → Scope Resolution
    ↓              ↓                   ↓                  ↓
  Actor         Visible            Entity.known_to     Filtered Results
  Activates     Entities           += actor.id         (Known Only)
```

### 5. Navigation and Cross-References

- [ ] Add table of contents with section numbers
- [ ] Add cross-references between related sections:
  - "See Section 4.2 for scope extensions"
  - "Planning effects use operation handlers (Section 5.3)"
  - "Structural gates reference knowledge system (Section 6.1)"
- [ ] Add index of key terms
- [ ] Add glossary of GOAP terminology
- [ ] Link all examples to relevant specification sections

### 6. Stakeholder Alignment Section

```markdown
## Stakeholder Goals and Success Metrics

### Player Experience Goals
- NPCs make intelligent, believable decisions
- NPC behavior feels reactive and adaptive
- No noticeable lag from NPC planning (<300ms)
- NPCs don't exhibit omniscience (only use known info)

### Modder Experience Goals
- Easy to create new tasks (data-driven)
- Clear examples and documentation
- Fast iteration cycle (reload without restart)
- Good error messages for validation failures

### Technical Goals
- Memory efficient (browser-friendly)
- Performant (50+ NPCs planning)
- Maintainable (clear architecture)
- Testable (comprehensive test coverage)
- Extensible (support future features)
```

### 7. Schema Versioning Strategy

```markdown
## Schema Versioning

All GOAP schemas follow semantic versioning:
- Major version: Breaking changes (require migration)
- Minor version: Backward-compatible additions
- Patch version: Bug fixes, clarifications

Schema Version Compatibility:
- Task schema v1.x.x compatible with loader v1.x.x
- Goal schema v1.x.x compatible with loader v1.x.x
- Breaking changes require migration guide

Deprecation Policy:
- Deprecated fields supported for 2 major versions
- Warnings logged when deprecated fields used
- Migration guide provided for each breaking change
```

### 8. Cross-Mod Composition Rules

```markdown
## Cross-Mod Task Composition

Tasks can reference components, scopes, and actions from other mods:

Dependency Rules:
- Explicit dependencies in mod-manifest.json
- Cannot use components from non-dependent mods
- Load order: Dependencies before dependents

Scope Resolution:
- Scopes resolved across all loaded mods
- Scope namespace must match mod providing component
- Example: mod "survival" can use "core:actor" scope

Action References:
- Refinement can produce actions from any loaded mod
- Action namespace validation at load time
- Missing action = validation error

Conflict Resolution:
- Task ID conflicts: Later mod overrides (with warning)
- Scope ID conflicts: First mod wins
- Action ID conflicts: Validation error (must be unique)
```

### 9. Final Review Checklist

- [ ] All sections use clear ownership (no passive voice)
- [ ] All requirements use RFC 2119 keywords
- [ ] No uncertainty or preferences remain
- [ ] Phasing strategy complete
- [ ] Observability strategy specified
- [ ] Architecture diagrams included
- [ ] Navigation aids complete
- [ ] Stakeholder goals linked
- [ ] Schema versioning defined
- [ ] Cross-mod rules specified
- [ ] Professional tone throughout
- [ ] No placeholder text ("TBD", "TODO", etc.)

## Expected Outputs

1. **Polished Specification**: `specs/goap-system-specs.md` (updated)
   - Professional language throughout
   - Clear requirements and ownership
   - Complete phasing strategy
   - Comprehensive navigation

2. **Architecture Diagrams**: `docs/goap/architecture-diagrams/`
   - System overview
   - Planning flow
   - Refinement process
   - Knowledge system

3. **Glossary and Index**: `docs/goap/glossary.md`
   - Key terms defined
   - Acronyms explained
   - Concept index

4. **Observability Guide**: `docs/goap/observability-guide.md`
   - Logging strategy
   - Monitoring metrics
   - Debugging tools
   - Development mode

## Success Metrics

- Specification reads professionally
- No ambiguity or uncertainty
- Clear phase boundaries
- Complete navigation
- Diagrams clarify architecture
- Ready for implementation handoff
