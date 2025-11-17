export const GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT = {
  version: '1.2.0',
  sections: {
    taskLibrary: {
      id: 'taskLibrary',
      label: 'Task Library Diagnostics',
      controllerMethod: 'getTaskLibraryDiagnostics',
    },
    planningState: {
      id: 'planningState',
      label: 'Planning State Diagnostics',
      controllerMethod: 'getPlanningStateDiagnostics',
    },
    eventCompliance: {
      id: 'eventCompliance',
      label: 'Event Contract Compliance',
      controllerMethod: 'getEventComplianceDiagnostics',
    },
    goalPathViolations: {
      id: 'goalPathViolations',
      label: 'Goal Path Violations',
      controllerMethod: 'getGoalPathDiagnostics',
    },
    effectFailureTelemetry: {
      id: 'effectFailureTelemetry',
      label: 'Effect Failure Telemetry',
      controllerMethod: 'getEffectFailureTelemetry',
    },
  },
  missingWarningCode: 'GOAP_DEBUGGER_DIAGNOSTICS_MISSING',
  staleThresholdMs: 5 * 60 * 1000,
};
