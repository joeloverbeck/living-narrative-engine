# GOADISANA-022: Verify Build System Works

## Context

After removing GOAP code and verifying no import errors, we must confirm that the build system still works correctly. This ensures the bundled application is valid and that bundle size has reduced appropriately with the removed code.

**Fatal Flaw Context**: Removing 67 GOAP files should reduce bundle size. Build verification ensures the application can still be packaged for distribution.

## Objective

Verify the build process completes successfully and produces valid output with reduced bundle size.

## Files Affected

**No source files modified** - verification only

**Generated files**:
- `dist/` directory (build output)
- Bundle size reports

## Detailed Steps

1. **Clean previous build artifacts**:
   ```bash
   rm -rf dist/
   ```

2. **Run full build**:
   ```bash
   npm run build 2>&1 | tee tickets/build-output.txt
   ```
   - Must complete without errors
   - Note any warnings

3. **Verify build artifacts created**:
   ```bash
   ls -lh dist/ > tickets/build-artifacts.txt
   cat tickets/build-artifacts.txt
   ```
   - Check that expected files exist
   - Note bundle sizes

4. **Compare bundle size** (if baseline available):
   ```bash
   # From GOADISANA-002 baseline
   du -sh pre-removal-coverage-*/dist/ 2>/dev/null || echo "No baseline"
   du -sh dist/
   ```
   - Bundle size should be smaller

5. **Check for GOAP references in bundle**:
   ```bash
   # Check if any GOAP code accidentally bundled
   grep -i "goap\|effectsGenerator\|goalManager" dist/*.js || echo "No GOAP references (expected)"
   ```

6. **Verify no build warnings related to GOAP**:
   ```bash
   grep -i "goap\|effectsGenerator\|planningEffects" tickets/build-output.txt
   ```
   - Should return empty

7. **Document build results**:
   - Build success/failure
   - Bundle size comparison
   - Any warnings or issues

## Acceptance Criteria

- [ ] `npm run build` completes successfully (exit code 0)
- [ ] Build output saved to `tickets/build-output.txt`
- [ ] Build artifacts exist in `dist/` directory
- [ ] Bundle size is smaller than pre-removal baseline (if available)
- [ ] No GOAP-related warnings in build output
- [ ] No GOAP code references in bundled output
- [ ] Build artifacts list saved to `tickets/build-artifacts.txt`

## Dependencies

**Requires**:
- GOADISANA-021 (no import errors verified)

**Blocks**:
- GOADISANA-023 (test suite verification)

## Verification Commands

```bash
# Clean and rebuild
rm -rf dist/
npm run build
echo "Build exit code: $?"

# Check dist/ contents
ls -lh dist/

# Measure bundle sizes
du -h dist/*.js | sort -h

# Search for GOAP in bundles (should be empty)
grep -l "goapTokens\|IGoalManager\|effectsGenerator" dist/*.js 2>/dev/null || echo "Clean bundle"

# Check build log for issues
cat tickets/build-output.txt | grep -i "error\|warning"

# Verify esbuild metafile (if generated)
cat dist/meta.json 2>/dev/null | grep -i goap || echo "No GOAP in metafile"
```

## Expected Build Output

**Success Indicators**:
- Exit code: 0
- No error messages
- dist/ directory populated
- Bundle size reduced by ~10-30KB (GOAP code removed)
- No deprecation warnings related to removed code

**Bundle Size Changes**:
- Main bundle: Should be smaller
- Vendor chunks: Unchanged (no GOAP dependencies)
- Source maps: Smaller (less code mapped)

## Bundle Size Analysis

**Expected Reductions** (approximate):
- Core services: ~5-10KB minified
- Test helpers: Not bundled (no impact)
- Type definitions: Compilation only (no impact)

**If Bundle Not Smaller**:
- Tree-shaking may not have occurred
- Dead code elimination issue
- Check esbuild configuration
- Verify imports fully removed

## If Build Fails

**Common Issues**:
1. **Import errors**: Go back to GOADISANA-021
2. **Type errors**: Check TypeScript compilation
3. **Dependency issues**: Run `npm install`
4. **Configuration errors**: Check build scripts

**Resolution Steps**:
1. Read error message carefully
2. Identify failing module/file
3. Determine if GOAP-related or unrelated
4. Fix issue before marking complete
5. Document fix in commit message

## Notes

- Build must succeed before proceeding to test verification
- Bundle size reduction confirms code removal effectiveness
- Any GOAP references in bundle indicate incomplete cleanup
- Build verification is critical for production readiness
- Save build output for troubleshooting if needed
