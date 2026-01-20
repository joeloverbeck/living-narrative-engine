# PROREDANAV2-002: Add DI Tokens for New Services

## Description

Add DI tokens for the three new services required by the v2 specification: GateConstraintExtractor, GateImplicationEvaluator, and GateBandingSuggestionBuilder.

## Files to Touch

### Modify
- `src/dependencyInjection/tokens/tokens-diagnostics.js`

## Out of Scope

- Creating the actual service classes (PROREDANAV2-007, 008, 015)
- Registering factories in prototypeOverlapRegistrations.js (PROREDANAV2-013)
- Any implementation code
- Config changes
- Test file creation (tokens don't typically have dedicated tests)

## Changes Required

Add three new tokens to the `diagnosticsTokens` object:

```javascript
// Gate structure analysis services
IGateConstraintExtractor: 'IGateConstraintExtractor',
IGateImplicationEvaluator: 'IGateImplicationEvaluator',

// Recommendation enhancement service
IGateBandingSuggestionBuilder: 'IGateBandingSuggestionBuilder',
```

## Acceptance Criteria

### Tests That Must Pass

1. **Existing DI registration tests**: All existing tests in `tests/unit/dependencyInjection/` continue to pass
2. **Token uniqueness**: No duplicate token string values in the tokens file
3. **Export verification**: Tokens are properly exported and accessible

### Invariants That Must Remain True

- Existing tokens unchanged (ICandidatePairFilter, IBehavioralOverlapEvaluator, IOverlapClassifier, IOverlapRecommendationBuilder, IPrototypeOverlapAnalyzer)
- Token naming follows existing convention: `I` prefix + PascalCase service name
- Token string values match token key names
- No circular dependencies

## Estimated Size

~10 lines of code

## Dependencies

None - can be implemented in parallel with PROREDANAV2-001.

## Verification Commands

```bash
# Verify no syntax errors
npm run typecheck

# Lint the tokens file
npx eslint src/dependencyInjection/tokens/tokens-diagnostics.js

# Run DI registration tests to ensure no breakage
npm run test:unit -- --testPathPattern=registrations
```
