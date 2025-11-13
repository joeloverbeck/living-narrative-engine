# GOADISANA-025: Verify Application Startup

## Context

This is the final verification ticket. After all GOAP removal, build verification, test verification, and routing verification, we must confirm that the application starts successfully without any dependency injection errors or GOAP-related runtime errors.

**Fatal Flaw Context**: Complete GOAP removal should not prevent application startup. This verification ensures the system is fully functional without GOAP services.

## Objective

Start the application and verify it initializes correctly without DI resolution errors, GOAP-related errors, or startup failures.

## Files Affected

**No files modified** - verification only

**Generated files**:
- Startup logs
- Console output capture

## Detailed Steps

1. **Start the application**:
   ```bash
   npm run start 2>&1 | tee tickets/startup-output.txt &
   APP_PID=$!
   ```
   - Capture console output
   - Note process ID for cleanup

2. **Wait for startup to complete** (10-30 seconds):
   ```bash
   sleep 15
   ```

3. **Check for startup errors**:
   ```bash
   grep -i "error" tickets/startup-output.txt
   ```
   - Should be empty or only non-critical errors

4. **Check for GOAP-related errors**:
   ```bash
   grep -i "goap\|effectsGenerator\|goalManager\|planningEffects" tickets/startup-output.txt
   ```
   - Should be empty

5. **Check for DI resolution errors**:
   ```bash
   grep -i "cannot resolve\|dependency.*not found\|token.*not registered" tickets/startup-output.txt
   ```
   - Should be empty

6. **Verify application is responsive**:
   ```bash
   # Check if process is running
   ps -p $APP_PID > /dev/null && echo "Application running" || echo "Application crashed"
   ```

7. **Check for specific provider registrations**:
   ```bash
   # Look for successful registrations in logs
   grep -i "provider.*registered\|decision.*provider\|IGoapDecisionProvider" tickets/startup-output.txt
   ```

8. **Stop the application gracefully**:
   ```bash
   kill -SIGTERM $APP_PID
   wait $APP_PID
   ```

9. **Document startup results**:
   - Application started successfully: YES/NO
   - Errors found: NONE/LIST
   - GOAP references in logs: NONE/LIST
   - DI errors: NONE/LIST

## Acceptance Criteria

- [ ] `npm run start` executes without fatal errors
- [ ] Application process starts and continues running
- [ ] No DI resolution errors in console
- [ ] No GOAP-related errors in console
- [ ] No "cannot resolve" or "token not registered" errors
- [ ] Startup logs saved to `tickets/startup-output.txt`
- [ ] Application responds correctly (doesn't crash immediately)
- [ ] Clean shutdown possible
- [ ] All verification results documented

## Dependencies

**Requires ALL previous tickets**:
- GOADISANA-001 through GOADISANA-024

This is the **FINAL VERIFICATION** ticket.

## Verification Commands

```bash
# Clean startup
npm run start > tickets/startup-output.txt 2>&1 &
APP_PID=$!
echo "Started with PID: $APP_PID"

# Wait for initialization
sleep 15

# Check if running
ps -p $APP_PID
echo "Running: $?"

# Check for errors
echo "=== Error Check ==="
grep -i "error" tickets/startup-output.txt | head -10

# Check for GOAP references
echo "=== GOAP References ==="
grep -i "goap" tickets/startup-output.txt || echo "None found"

# Check for DI errors
echo "=== DI Resolution ==="
grep -i "cannot resolve\|not registered" tickets/startup-output.txt || echo "No DI errors"

# Stop application
kill -SIGTERM $APP_PID
wait $APP_PID
echo "Application stopped"

# View startup summary
head -50 tickets/startup-output.txt
tail -50 tickets/startup-output.txt
```

## Expected Startup Behavior

**Success Indicators**:
- Process starts (PID assigned)
- No fatal exceptions thrown
- All DI tokens resolve successfully
- Providers registered correctly
- Application reaches "ready" state
- No GOAP-related errors
- Clean shutdown possible

**Acceptable Log Entries**:
- Info: "Container initialized"
- Info: "Providers registered"
- Info: "Application started"
- Debug: Provider resolution logs

**Unacceptable Log Entries**:
- Error: "Cannot resolve token: IGoalManager"
- Error: "Cannot find module: './goap/...'"
- Error: "goapTokens is not defined"
- Error: "registerGoapServices is not a function"

## If Startup Fails

**Common Issues**:
1. **DI resolution error**: Missing provider registration
   - Check aiRegistrations.js
   - Verify GoapDecisionProvider stub registered

2. **Import error**: Incomplete cleanup
   - Go back to GOADISANA-021
   - Fix remaining imports

3. **Configuration error**: Missing required services
   - Check baseContainerConfig.js
   - Verify no GOAP service references

4. **Runtime error**: Unexpected dependency
   - Analyze stack trace
   - Identify GOAP-related code
   - Complete cleanup

**Resolution Steps**:
1. Read error message and stack trace
2. Identify root cause (DI, import, config, runtime)
3. Determine if GOAP-related
4. Fix issue in appropriate ticket scope
5. Re-run verification
6. Document fix

## Final Verification Checklist

After this ticket completes successfully:

- [x] All GOAP services removed (GOADISANA-004)
- [x] All DI tokens and registrations removed (GOADISANA-005, 006, 007)
- [x] Provider stub implemented (GOADISANA-008)
- [x] Schemas cleaned up (GOADISANA-009, 010, 011)
- [x] All tests removed (GOADISANA-012-017)
- [x] All documentation removed (GOADISANA-018-020)
- [x] No import errors (GOADISANA-021)
- [x] Build succeeds (GOADISANA-022)
- [x] All tests pass (GOADISANA-023)
- [x] Routing works (GOADISANA-024)
- [x] Application starts (GOADISANA-025) ← THIS TICKET

**If all checkboxes complete**: GOAP removal is SUCCESSFUL ✅

## Next Steps After Success

1. **Create final removal PR** with comprehensive commit message
2. **Tag release**: `v1.x.x-goap-removed`
3. **Update main README** noting GOAP removal
4. **Plan future task-based implementation**
5. **Close all GOAP-related tickets**

## Notes

- This is the final quality gate before merging
- Application must start successfully to complete removal
- Startup verification confirms full system functionality
- Clean startup proves GOAP dependency eliminated
- Success indicates readiness for production deployment
- This ticket completion signifies end of dismantling phase
