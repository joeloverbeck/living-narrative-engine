export const GOAP_DEBUGGER_DIAGNOSTICS_CONTRACT = {
  version: '1.0.0',
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
  },
  missingWarningCode: 'GOAP_DEBUGGER_DIAGNOSTICS_MISSING',
  staleThresholdMs: 5 * 60 * 1000,
};
