# GOAP Event Trace Hardening

## Background
Integration suites recently failed because `GOAPDebugger` was instantiated without an `IGoapEventTraceProbe`. The current production code rightfully enforces the dependency (per `docs/goap/debugging-tools.md`), but our DI wiring and tests do not guarantee that probes are attached to the dispatcher before debugging begins. This gap makes diagnostics brittle and masks missing instrumentation until runtime. We need a resilient plan so the debugger always has a compliant probe, and so the absence of capture coverage is surfaced immediately.

## Goals
- Guarantee that every `GOAPDebugger` instance resolved through DI receives a fully wired probe (real or null-safe) without requiring manual plumbing.
- Ensure GOAP integration harnesses automatically attach probes so `startTrace()` actually captures dispatcher events.
- Add proactive detection so missing probes or dispatcher wiring emits an actionable signal before tests reach the debugger constructor.
- Document and test these guarantees so future regressions fail fast.

## Non-Goals
- Rewriting the GOAP debugger diagnostics contract beyond enforcing the existing sections.
- Building new visualization tooling for traces; this spec focuses purely on dependency resilience and observability.

## Proposed Changes
1. **DI Default & Null Probe**
   - Introduce `createNullGoapEventTraceProbe()` that implements the `IGoapEventTraceProbe` surface but no-ops (records nothing, always returns empty buffers).
   - Update `dependencyInjection/registrations/goapRegistrations.js` so the `tokens.IGoapEventTraceProbe` registration composes as: real probe (from dispatcher options) → fallback to the null probe if no dispatcher wiring occurs.
   - `GOAPDebugger` continues to require the dependency, but DI guarantees something valid is injected.
   - Emit a single `GOAP_DEBUGGER_TRACE_PROBE_FALLBACK` warning whenever the null probe is used so environments realize tracing is disabled.

2. **Automatic Probe Attachment in Test Fixtures**
   - Extend `tests/integration/goap/testFixtures/goapTestSetup.js` with a `bootstrapEventTraceProbe()` helper that:
     - Creates a default probe via `createGoapEventTraceProbe({ logger: testBed.createMockLogger() })`.
     - Immediately registers it with the dispatcher and returns `{ probe, detach }` so suites can opt out if needed.
   - Update every integration diagnostic suite (plus fixtures like `createGoapTestSetup`) to call this helper during setup, ensuring no test can forget to wire probes again.

3. **Dispatcher Health Check**
   - When `createGoapEventDispatcher()` is instantiated without at least one probe, log an info-level `GOAP_EVENT_TRACE_DISABLED` message explaining tracing is unavailable.
   - Add a `diagnostics` getter on the dispatcher that the debugger (and tests) can call to verify whether any probes are active. When the debugger's `startTrace()` runs against a dispatcher reporting `activeProbes === 0`, log a warning instructing developers to call `attachEventTraceProbe()`.

4. **Test Coverage**
   - Add a unit test suite for `GOAPDebugger` that mocks the dispatcher diagnostics API to confirm warnings fire when tracing is attempted without probes.
   - Add an integration test under `tests/integration/goap/debug/goapEventTraceHardening.integration.test.js` that:
     - Spins up `createGoapTestSetup()` without manual probe plumbing.
     - Verifies the helper auto-attaches probes and `startTrace()` captures at least one dispatcher event after `decideTurn()`.
   - Update CI smoke tests (`npm run test:integration`) to assert no `GOAP_DEBUGGER_TRACE_PROBE_FALLBACK` or `GOAP_EVENT_TRACE_DISABLED` logs appear. Treat their presence as failures to keep instrumentation from silently drifting.

## Detection & Monitoring
- **Log Hooks**: Standardize on two warning codes (`GOAP_DEBUGGER_TRACE_PROBE_FALLBACK`, `GOAP_EVENT_TRACE_DISABLED`) and have integration tests grep for them.
- **Metrics**: Extend the `eventTraceProbe.getTotals()` output to include `attachedAtLeastOnce` so dashboards can alert if tracing never ran across a session.
- **Doc Updates**: Append a "Trace Wiring Checklist" subsection to `docs/goap/debugging-tools.md` summarizing the automatic probe behavior and troubleshooting steps if the warning codes surface.

## Rollout Plan
1. Land the null-probe + DI change with exhaustive unit tests.
2. Update `goapTestSetup` and existing diagnostic suites to rely on the new helper; delete redundant probe plumbing.
3. Add dispatcher diagnostics + log warnings, followed by the new unit/integration tests.
4. Update docs and CI log-grep automation.
5. Monitor `npm run test:integration` for a full cycle to ensure no new warnings surface; once stable, enforce the grep as a hard gate in `npm run test:ci`.
