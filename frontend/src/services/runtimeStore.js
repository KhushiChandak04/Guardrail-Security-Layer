const MAX_AUDIT_LOGS = 200;

let runtimeSessionId = "";
let runtimeAuditLogs = [];

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getRuntimeSessionId() {
  if (!runtimeSessionId) {
    runtimeSessionId = createSessionId();
  }
  return runtimeSessionId;
}

export function resetRuntimeSessionId() {
  runtimeSessionId = "";
}

export function appendRuntimeAuditLog(entry) {
  runtimeAuditLogs = [entry, ...runtimeAuditLogs].slice(0, MAX_AUDIT_LOGS);
}

export function getRuntimeAuditLogs() {
  return [...runtimeAuditLogs];
}

export function clearRuntimeAuditLogs() {
  runtimeAuditLogs = [];
}
