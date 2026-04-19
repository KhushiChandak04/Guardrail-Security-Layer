const EXTENSION_PING_EVENT = "guardrail_extension_ping";
const EXTENSION_PONG_EVENT = "guardrail_extension_pong";
const EXTENSION_MESSAGE_PING = "GUARDRAIL_EXTENSION_PING";
const EXTENSION_MESSAGE_PONG = "GUARDRAIL_EXTENSION_PONG";
const DEFAULT_TIMEOUT_MS = 2400;

function makeRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ext-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export async function probeExtensionConnection({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof window === "undefined") {
    return {
      connected: false,
      reason: "window_unavailable",
      requestId: "",
    };
  }

  return new Promise((resolve) => {
    const requestId = makeRequestId();
    const resolvedTimeout = Math.max(300, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
    let settled = false;
    let timerId = null;
    let retryId = null;

    const cleanup = () => {
      window.removeEventListener(EXTENSION_PONG_EVENT, onPong);
      window.removeEventListener("message", onMessagePong);
      if (timerId) {
        window.clearTimeout(timerId);
      }
      if (retryId) {
        window.clearTimeout(retryId);
      }
    };

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const onPong = (event) => {
      const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
      const replyRequestId = String(detail?.requestId || "").trim();
      if (replyRequestId !== requestId) {
        return;
      }

      finish({
        connected: true,
        requestId,
        detail,
        channel: "custom_event",
      });
    };

    const onMessagePong = (event) => {
      if (event?.source !== window) {
        return;
      }

      const payload = event?.data && typeof event.data === "object" ? event.data : null;
      if (!payload || payload.type !== EXTENSION_MESSAGE_PONG) {
        return;
      }

      const replyRequestId = String(payload?.requestId || "").trim();
      if (replyRequestId !== requestId) {
        return;
      }

      finish({
        connected: true,
        requestId,
        detail: payload,
        channel: "post_message",
      });
    };

    const sendProbe = () => {
      const payload = {
        type: EXTENSION_MESSAGE_PING,
        requestId,
        source: "guardrail_webapp",
        issuedAt: new Date().toISOString(),
      };
      let dispatched = false;

      try {
        window.postMessage(payload, "*");
        dispatched = true;
      } catch {
        // Ignore and fall back to custom event dispatch.
      }

      try {
        window.dispatchEvent(
          new CustomEvent(EXTENSION_PING_EVENT, {
            detail: {
              requestId,
              source: "guardrail_webapp",
              issuedAt: payload.issuedAt,
            },
          }),
        );
        dispatched = true;
      } catch {
        // Ignore custom event dispatch failures.
      }

      return dispatched;
    };

    window.addEventListener(EXTENSION_PONG_EVENT, onPong);
    window.addEventListener("message", onMessagePong);

    const sent = sendProbe();
    if (!sent) {
      finish({
        connected: false,
        requestId,
        reason: "dispatch_failed",
      });
      return;
    }

    retryId = window.setTimeout(() => {
      if (!settled) {
        sendProbe();
      }
    }, Math.min(800, Math.round(resolvedTimeout / 2)));

    timerId = window.setTimeout(() => {
      finish({
        connected: false,
        requestId,
        reason: "timeout",
      });
    }, resolvedTimeout);
  });
}
