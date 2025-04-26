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

let requests = new Map<string, RequestData>();
let monitoringState: MonitoringState = { isMonitoring: false };

// Initialize state from storage
chrome.storage.local.get(["monitoringState"], (result) => {
  if (result.monitoringState) {
    monitoringState = result.monitoringState;
    if (monitoringState.isMonitoring && monitoringState.tabId) {
      startMonitoring(monitoringState.tabId);
    }
  }
});

// Start monitoring network requests for a tab
async function startMonitoring(tabId: number) {
  if (monitoringState.isMonitoring) return;

  try {
    // Attach debugger to the tab
    await chrome.debugger.attach({ tabId }, "1.0");

    // Enable network tracking
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");

    monitoringState = { isMonitoring: true, tabId };
    await chrome.storage.local.set({ monitoringState });

    // Listen for network events
    chrome.debugger.onEvent.addListener(handleDebuggerEvent);
  } catch (error) {
    console.error("Failed to start monitoring:", error);
  }
}

// Stop monitoring network requests
async function stopMonitoring(tabId: number) {
  if (!monitoringState.isMonitoring) return;

  try {
    await chrome.debugger.detach({ tabId });
    monitoringState = { isMonitoring: false };
    await chrome.storage.local.set({ monitoringState });
    requests.clear();
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
  if (!monitoringState.isMonitoring) return;

  switch (message) {
    case "Network.requestWillBeSent":
      requests.set(params.requestId, {
        request: {
          url: params.request.url,
          method: params.request.method,
          headers: params.request.headers,
        },
        timestamp: Date.now(),
      });
      break;

    case "Network.responseReceived":
      const requestData = requests.get(params.requestId);
      if (requestData) {
        requestData.response = params.response;
        // Only store JSON responses
        if (params.response.mimeType === "application/json") {
          chrome.debugger.sendCommand(
            debuggeeId,
            "Network.getResponseBody",
            { requestId: params.requestId },
            (response) => {
              const responseData = response as GetResponseBodyResponse;
              if (responseData?.body) {
                try {
                  requestData.responseBody = JSON.parse(responseData.body);
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

// Handle tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (monitoringState.tabId === tabId) {
    stopMonitoring(tabId);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
      sendResponse({ monitoringState });
      break;

    case "GET_REQUESTS":
      sendResponse({
        requests: Array.from(requests.entries())
          .filter(([_, data]) => data.responseBody) // Only return requests with JSON responses
          .map(([id, data]) => ({
            id,
            url: data.request.url,
            method: data.request.method,
            timestamp: data.timestamp,
            responseBody: data.responseBody,
          })),
      });
      break;
  }
  return true;
});
