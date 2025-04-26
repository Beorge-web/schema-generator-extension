interface RequestData {
  request: {
    url: string;
    method: string;
    headers?: Record<string, string>;
  };
  timestamp: number;
  response?: any;
  responseBody?: any;
}

interface GetResponseBodyResponse {
  body: string;
  base64Encoded: boolean;
}

interface MonitoringState {
  isMonitoring: boolean;
  tabId?: number;
}

// Store state per tab
const tabStates = new Map<number, {
  requests: Map<string, RequestData>;
  monitoringState: MonitoringState;
}>();

// Initialize or get tab state
function getTabState(tabId: number) {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, {
      requests: new Map<string, RequestData>(),
      monitoringState: { isMonitoring: false }
    });
  }
  return tabStates.get(tabId)!;
}

// Cleanup tab state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const tabState = tabStates.get(tabId);
  if (tabState?.monitoringState.isMonitoring) {
    stopMonitoring(tabId);
  }
  tabStates.delete(tabId);
});

// Start monitoring network requests for a tab
async function startMonitoring(tabId: number) {
  const tabState = getTabState(tabId);
  if (tabState.monitoringState.isMonitoring) return;

  try {
    await chrome.debugger.attach({ tabId }, "1.0");
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");
    
    tabState.monitoringState = { isMonitoring: true, tabId };
    tabState.requests.clear();
    
    chrome.debugger.onEvent.addListener(handleDebuggerEvent);
  } catch (error) {
    console.error("Failed to start monitoring:", error);
  }
}

// Stop monitoring network requests
async function stopMonitoring(tabId: number) {
  const tabState = getTabState(tabId);
  if (!tabState.monitoringState.isMonitoring) return;

  try {
    await chrome.debugger.detach({ tabId });
    tabState.monitoringState = { isMonitoring: false };
    chrome.debugger.onEvent.removeListener(handleDebuggerEvent);
  } catch (error) {
    console.error("Failed to stop monitoring:", error);
  }
}

// Handle debugger events
function handleDebuggerEvent(
  debuggeeId: chrome.debugger.Debuggee,
  message: string,
  params: any
) {
  const tabId = debuggeeId.tabId;
  if (!tabId) return;

  const tabState = getTabState(tabId);
  if (!tabState.monitoringState.isMonitoring) return;

  switch (message) {
    case "Network.requestWillBeSent":
      tabState.requests.set(params.requestId, {
        request: {
          url: params.request.url,
          method: params.request.method,
          headers: params.request.headers,
        },
        timestamp: Date.now(),
      });
      break;

    case "Network.responseReceived":
      const requestData = tabState.requests.get(params.requestId);
      if (requestData) {
        requestData.response = params.response;
        // Only store JSON responses
        if (params.response.mimeType === "application/json") {
          chrome.debugger.sendCommand(
            debuggeeId,
            "Network.getResponseBody",
            { requestId: params.requestId },
            (response: any) => {
              if (response?.body) {
                try {
                  requestData.responseBody = JSON.parse(response.body);
                } catch (e) {
                  console.error("Failed to parse response body:", e);
                }
              }
            }
          );
        }
      }
      break;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message.tabId) {
    sendResponse({ error: "No tabId provided" });
    return true;
  }

  const tabState = getTabState(message.tabId);

  switch (message.type) {
    case "START_MONITORING":
      startMonitoring(message.tabId);
      sendResponse({ success: true });
      break;

    case "STOP_MONITORING":
      stopMonitoring(message.tabId);
      sendResponse({ success: true });
      break;

    case "GET_MONITORING_STATE":
      sendResponse({ monitoringState: tabState.monitoringState });
      break;

    case "GET_REQUESTS":
      sendResponse({
        requests: Array.from(tabState.requests.entries()).map(([id, data]) => ({
          id,
          url: data.request.url,
          method: data.request.method,
          timestamp: data.timestamp,
          responseBody: data.responseBody,
        })),
      });
      break;

    case "CLEAR_REQUESTS":
      tabState.requests.clear();
      sendResponse({ success: true });
      break;
  }
  return true;
});
