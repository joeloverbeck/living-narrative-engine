# HARMODREF Ticket Series - Hardcoded Mod References Refactoring

**Generated:** 2025-11-15
**Report Source:** [reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md)
**Total Tickets:** 20

## Overview

This ticket series addresses the architectural violations identified in the hardcoded mod references analysis. The Living Narrative Engine claims to be "modding-first" but currently has 65+ hardcoded references to non-core mods, undermining modularity.

## Ticket Organization

### P0: Critical Fixes (3 tickets - 4 hours total)

**Must be completed immediately:**

| Ticket | Title | Effort | Status |
|--------|-------|--------|--------|
| HARMODREF-001 | Remove p_erotica debug code | 15 min | Not Started |
| HARMODREF-002 | Add ESLint rule for mod references | 1 hour | Not Started |
| HARMODREF-003 | Audit remaining non-core references | 2 hours | Not Started |

**Quick wins**: Fix critical debug code leak and prevent future violations with automated linting.

---

### P1: Short-Term Refactoring (13 tickets - 6-8 weeks)

**Component Type Registry Implementation:**

| Ticket | Title | Effort | Dependencies |
|--------|-------|--------|--------------|
| HARMODREF-010 | Design Component Type Registry | 1 day | HARMODREF-003 |
| HARMODREF-011 | Implement Component Type Registry | 3 days | HARMODREF-010 |
| HARMODREF-012 | Update mod manifests | 1 day | HARMODREF-011 |

**Operation Handler Refactoring:**

| Ticket | Title | Effort | Dependencies |
|--------|-------|--------|--------------|
| HARMODREF-013 | Refactor EstablishSittingClosenessHandler | 2 hours | HARMODREF-012 |
| HARMODREF-014 | Refactor positioning handlers | 1 week | HARMODREF-013 |
| HARMODREF-015 | Refactor items handlers | 1 week | HARMODREF-013 |
| HARMODREF-016 | Refactor TargetComponentValidationStage | 1 day | None |
| HARMODREF-017 | Refactor SlotAccessResolver | 3 days | HARMODREF-011 |
| HARMODREF-018 | Refactor affection/violence/clothing | 3 days | HARMODREF-011 |

**Documentation & Validation:**

| Ticket | Title | Effort | Dependencies |
|--------|-------|--------|--------------|
| HARMODREF-030 | Create mod development guide | 1 week | HARMODREF-011 |
| HARMODREF-031 | Create architecture validation suite | 1 week | HARMODREF-002 |

---

### P2: Long-Term Architecture (6 tickets - 12-14 weeks)

**Plugin Architecture:**

| Ticket | Title | Effort | Dependencies |
|--------|-------|--------|--------------|
| HARMODREF-020 | Design plugin architecture | 2 weeks | HARMODREF-014, 015 |
| HARMODREF-021 | Implement plugin infrastructure | 4 weeks | HARMODREF-020 |

**Plugin Migrations:**

| Ticket | Title | Effort | Dependencies |
|--------|-------|--------|--------------|
| HARMODREF-022 | Migrate scope DSL to plugins | 2 weeks | HARMODREF-021 |
| HARMODREF-023 | Migrate inventory validation | 2 weeks | HARMODREF-021 |
| HARMODREF-024 | Migrate action pipeline validation | 2 weeks | HARMODREF-021 |
| HARMODREF-025 | Review core mod references | 1 week | HARMODREF-011 |

---

## Critical Path

```
Week 1:  HARMODREF-001, 002, 003 (P0)
Week 2:  HARMODREF-010 (Design)
Week 3:  HARMODREF-011 (Implementation)
Week 4:  HARMODREF-012, 013 (Manifests + Proof-of-concept)
Week 5-6: HARMODREF-014 (Positioning handlers)
Week 7-8: HARMODREF-015 (Items handlers)
Week 9:  HARMODREF-016, 017, 018 (Validation + remaining)
Week 10: HARMODREF-030, 031 (Documentation + validation)
---
Week 11-12: HARMODREF-020 (Plugin design)
Week 13-16: HARMODREF-021 (Plugin implementation)
Week 17-18: HARMODREF-022 (Scope DSL migration)
Week 19-20: HARMODREF-023 (Inventory migration)
Week 21-22: HARMODREF-024 (Action pipeline migration)
Week 23: HARMODREF-025 (Core mod review)
```

**Total Timeline:** ~5-6 months for complete refactoring

---

## Success Metrics

### Code Quality Metrics

| Metric | Current | After P0 | After P1 | After P2 |
|--------|---------|----------|----------|----------|
| Hardcoded non-core refs | 65+ | ~65 | <20 | 0 |
| Core refs requiring review | 20 | 20 | 10 | 5 |
| Files with violations | 35+ | ~30 | <10 | 0 |
| ESLint violations | N/A | 0 | 0 | 0 |
| Test coverage | N/A | N/A | >85% | >90% |

### Architectural Goals

**After P0 (Week 1):**
- ✅ Critical debug code removed
- ✅ Future violations prevented by linting
- ✅ Complete audit of violations available

**After P1 (Week 10):**
- ✅ Component Type Registry operational
- ✅ ~45 operation handlers refactored
- ✅ Mods can provide alternative implementations
- ✅ Comprehensive developer documentation
- ✅ Automated architecture validation

**After P2 (Week 23):**
- ✅ Plugin architecture complete
- ✅ True modding-first architecture
- ✅ Zero hardcoded mod dependencies
- ✅ Third-party mods can extend all systems

---

## Getting Started

### For Developers

1. **Start with P0** - Quick wins, high impact:
   ```bash
   # Remove debug code (15 minutes)
   git checkout -b fix/harmodref-001
   # Follow HARMODREF-001 instructions
   
   # Add ESLint rule (1 hour)
   git checkout -b feat/harmodref-002
   # Follow HARMODREF-002 instructions
   ```

2. **Continue with P1** - Foundation work:
   - Read HARMODREF-010 design carefully
   - Review HARMODREF-003 audit before implementation
   - Follow proof-of-concept pattern (HARMODREF-013)

3. **Plan for P2** - Long-term architecture:
   - Gain experience with registry pattern first
   - Design plugin architecture based on lessons learned
   - Implement incrementally with comprehensive testing

### For Project Managers

**Sprint Planning Recommendations:**

- **Sprint 1 (Week 1):** P0 tickets - immediate fixes
- **Sprints 2-4 (Weeks 2-4):** Registry design + implementation + first refactors
- **Sprints 5-8 (Weeks 5-8):** Bulk operation handler refactoring
- **Sprints 9-10 (Weeks 9-10):** Cleanup + documentation
- **Q2 Planning:** P2 plugin architecture (requires dedicated team)

---

## Resources

### Documentation
- **Original Report:** `reports/hardcoded-mod-references-analysis.md`
- **Architecture Guide:** (Created in HARMODREF-030)
- **Plugin Development:** (Created in HARMODREF-030)

### Related Systems
- **Component Type Registry:** Enables abstract component access
- **Plugin Architecture:** Enables system extensibility
- **Mod Manifest:** Declares component types and plugins

### Testing Strategy
- Unit tests for all refactored handlers (>85% coverage)
- Integration tests for mod loading and registration
- E2E tests for alternative mod implementations
- Performance tests for plugin overhead

---

## Common Questions

**Q: Can we skip P2 and just do P0+P1?**
A: P1 alone achieves ~70% of the benefit. P2 enables true extensibility for complex systems like scope DSL and inventory validation. Recommended to complete P1 first, then evaluate if P2 is needed.

**Q: What's the quickest path to shipping?**
A: Complete P0 (4 hours) before any release. P1 can be done incrementally - start with HARMODREF-010 through 013 for immediate architectural improvement.

**Q: How do we handle backward compatibility?**
A: Component Type Registry is additive - old code works during migration. Complete handlers one at a time. No breaking changes until all handlers migrated.

**Q: What if we find more violations during audit?**
A: HARMODREF-003 may reveal additional references. Create new tickets following the HARMODREF numbering (e.g., HARMODREF-019 for additional P1 work).

---

## Contact

For questions about this ticket series or the refactoring effort, refer to:
- **Original Analysis:** Architecture Team
- **Implementation Support:** See individual ticket descriptions
- **Escalations:** Reference reports/hardcoded-mod-references-analysis.md

---

**Last Updated:** 2025-11-15
**Next Review:** After P0 completion
