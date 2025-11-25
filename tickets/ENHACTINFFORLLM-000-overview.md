# ENHACTINFFORLLM-000: Overview - Enhanced Action Information for LLM Prompts

## Epic Summary
This epic adds contextual metadata (Purpose and Consider When) to action groups in LLM prompts, helping LLMs make more informed action selections during gameplay.

## Related Specification
- `specs/enhance-action-information-for-llm.md`

## Ticket Dependency Graph

```
ENHACTINFFORLLM-001 (Schema)
         │
         ▼
ENHACTINFFORLLM-002 (Service) ──────────────────┐
         │                                       │
         ▼                                       │
ENHACTINFFORLLM-003 (DI Registration)            │
         │                                       │
         ▼                                       │
ENHACTINFFORLLM-004 (Integration) ◄──────────────┤
         │                                       │
         ├──────────────────────────────────────►│
         │                                       │
         ▼                                       ▼
ENHACTINFFORLLM-005 (Unit Tests: Service)   ENHACTINFFORLLM-006 (Unit Tests: Provider)
         │                                       │
         └──────────────────┬────────────────────┘
                            │
                            ▼
                   ENHACTINFFORLLM-007 (Integration Tests)
                            │
                            ▼
                   ENHACTINFFORLLM-008 (Content: 5 Key Mods)
```

## Ticket Summary

| Ticket | Title | Files | Estimate |
|--------|-------|-------|----------|
| 001 | Schema Changes | 1 | 15 min |
| 002 | ModActionMetadataProvider Service | 1 (new) | 30 min |
| 003 | DI Registration | 2 | 15 min |
| 004 | AIPromptContentProvider Integration | 2 | 30 min |
| 005 | Unit Tests: ModActionMetadataProvider | 1 (new) | 30 min |
| 006 | Unit Tests: AIPromptContentProvider Metadata | 1 (new) | 30 min |
| 007 | Integration Tests | 1 (new) | 45 min |
| 008 | Content: 5 Key Mods | 5 | 20 min |

**Total Estimated Time:** ~3.5 hours

## Implementation Order

### Phase 1: Foundation (Tickets 001-003)
1. ✅ **ENHACTINFFORLLM-001**: Add schema properties
2. ✅ **ENHACTINFFORLLM-002**: Create ModActionMetadataProvider
3. ✅ **ENHACTINFFORLLM-003**: Register in DI container

### Phase 2: Integration (Ticket 004)
4. ✅ **ENHACTINFFORLLM-004**: Update AIPromptContentProvider

### Phase 3: Testing (Tickets 005-007)
5. ✅ **ENHACTINFFORLLM-005**: Unit tests for new service
6. ✅ **ENHACTINFFORLLM-006**: Unit tests for integration
7. ✅ **ENHACTINFFORLLM-007**: Integration tests

### Phase 4: Content (Ticket 008)
8. ✅ **ENHACTINFFORLLM-008**: Add metadata to 5 key mods

## Success Criteria (from spec)

1. [x] Two new optional properties in mod-manifest schema (ENHACTINFFORLLM-001 ✅)
2. [x] New `ModActionMetadataProvider` service with caching (ENHACTINFFORLLM-002 ✅)
3. [ ] `AIPromptContentProvider` displays Purpose/Consider when available
4. [ ] Graceful fallback when metadata not present
5. [ ] At least 5 mods have actionPurpose and actionConsiderWhen populated
6. [ ] Unit tests pass with >80% coverage on new code
7. [ ] Integration tests verify end-to-end formatting
8. [ ] No regression in existing prompt formatting behavior

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Namespace doesn't match mod ID | Registry uses normalized mod IDs; namespace extraction already tested |
| Long content bloats prompts | Schema enforces 200 char max per property |
| Missing manifests cause errors | Graceful null return with fallback to current behavior |

## Future Work (not in scope)

After this epic is complete, the remaining 24 mods should receive metadata:
- ballet, caressing, clothing, companionship, distress, exercise, gymnastics
- hand-holding, hugging, kissing, metabolism, movement, music, physical-control
- seduction, sex-anal-penetration, sex-breastplay, sex-dry-intimacy
- sex-penile-manual, sex-penile-oral, sex-physical-control, sex-vaginal-penetration
- vampirism, weapons
