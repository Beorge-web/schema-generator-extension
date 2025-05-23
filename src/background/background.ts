import { Validator } from 'jsonschema';

interface RequestData {
  request: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    type?: string;
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
  requestTypeFilter: 'all' | 'fetch';
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
      monitoringState: { isMonitoring: false, requestTypeFilter: 'fetch' }
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
async function startMonitoring(tabId: number, requestTypeFilter: 'all' | 'fetch' = 'fetch') {
  const tabState = getTabState(tabId);
  if (tabState.monitoringState.isMonitoring) return;

  try {
    await chrome.debugger.attach({ tabId }, "1.0");
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");
    
    tabState.monitoringState = { isMonitoring: true, tabId, requestTypeFilter };
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
    tabState.monitoringState = { ...tabState.monitoringState, isMonitoring: false };
    chrome.debugger.onEvent.removeListener(handleDebuggerEvent);
  } catch (error) {
    console.error("Failed to stop monitoring:", error);
  }
}

function preprocessJsonString(jsonStr: string): string {
  // Remove potential XSSI prefix )]}' that some APIs add
  const xssiPrefix = /^\)]}'\s*\n?/;
  if (xssiPrefix.test(jsonStr)) {
    jsonStr = jsonStr.replace(xssiPrefix, '');
  }
  
  // Try to handle cases where the response might be wrapped in parentheses
  if (jsonStr.startsWith('(') && jsonStr.endsWith(')')) {
    jsonStr = jsonStr.slice(1, -1);
  }
  
  return jsonStr.trim();
}

// Initialize validator
const validator = new Validator();

// Function to validate JSON response
function validateJsonResponse(data: any): { isValid: boolean; errors: string[] } {
  try {
    // Basic schema for JSON response
    const schema = {
      __type: "object",
      additionalProperties: true
    };

    const result = validator.validate(data, schema);
    return {
      isValid: result.valid,
      errors: result.errors.map(error => error.message)
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

// Function to generate a schema from a JSON object
function generateJsonSchema(data: any): any {
  const schema: any = {};
  
  if (Array.isArray(data)) {
    schema.__type = "array";
    if (data.length > 0) {
      // Take up to 10 items to infer array item schema
      const sampleItems = data.slice(0, 10);
      const itemSchemas = sampleItems.map(item => generateJsonSchema(item));
      schema.__items = mergeSchemas(itemSchemas);
    }
  } else if (data === null) {
    schema.__type = "null";
  } else if (typeof data === "object") {
    schema.__type = "object";
    schema.__properties = {};
    schema.__required = [];
    
    for (const [key, value] of Object.entries(data)) {
      // Skip generating schema for internal metadata fields
      if (key.startsWith('__')) {
        continue;
      }
      schema.__properties[key] = generateJsonSchema(value);
      if (value !== undefined) {
        schema.__required.push(key);
      }
    }
  } else {
    schema.__type = typeof data;
    if (typeof data === "number") {
      schema.__type = Number.isInteger(data) ? "integer" : "number";
    }
  }
  
  return schema;
}

// Helper function to merge multiple schemas
function mergeSchemas(schemas: any[]): any {
  if (schemas.length === 0) return {};
  if (schemas.length === 1) return schemas[0];
  
  const merged = { ...schemas[0] };
  const types = new Set(schemas.map(s => s.__type).flat().filter(Boolean));
  
  // If we have multiple types, make it a union
  merged.__type = types.size > 1 ? Array.from(types) : merged.__type;
  
  // Merge properties for objects
  if (merged.__type === 'object') {
    const allProperties = new Set(schemas.flatMap(s => Object.keys(s.__properties || {})));
    merged.__properties = {};
    merged.__required = [];
    
    for (const prop of allProperties) {
      // Skip merging internal metadata fields
      if (prop.startsWith('__')) {
        continue;
      }
      const propSchemas = schemas
        .filter(s => s.__properties?.[prop])
        .map(s => s.__properties[prop]);
      
      if (propSchemas.length > 0) {
        merged.__properties[prop] = mergeSchemas(propSchemas);
        // Only mark as required if present in all schemas
        if (schemas.every(s => s.__required?.includes(prop))) {
          merged.__required.push(prop);
        }
      }
    }
  }
  
  // Merge array items
  if (merged.__type === 'array' && schemas.some(s => s.__items)) {
    const itemSchemas = schemas.filter(s => s.__items).map(s => s.__items);
    merged.__items = mergeSchemas(itemSchemas);
  }
  
  return merged;
}

// Add these helper functions at the top level
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getResponseBodyWithRetry(
  debuggeeId: chrome.debugger.Debuggee,
  requestId: string,
  maxRetries: number = 3
): Promise<GetResponseBodyResponse | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await new Promise((resolve, reject) => {
        chrome.debugger.sendCommand(
          debuggeeId,
          "Network.getResponseBody",
          { requestId },
          (response: any) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          }
        );
      });
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error(`Failed to get response body after ${maxRetries} retries:`, error);
        return null;
      }
      // Exponential backoff
      await delay(Math.pow(2, i) * 100);
    }
  }
  return null;
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
      // Check if we should monitor this request type
      const requestType = params.type?.toLowerCase() || '';
      const isFetchOrXHR = requestType === 'fetch' || requestType === 'xhr';
      
      if (tabState.monitoringState.requestTypeFilter === 'fetch' && !isFetchOrXHR) {
        return;
      }

      tabState.requests.set(params.requestId, {
        request: {
          url: params.request.url,
          method: params.request.method,
          headers: params.request.headers,
          type: params.type,
        },
        timestamp: Date.now(),
      });
      break;

    case "Network.responseReceived":
      const requestData = tabState.requests.get(params.requestId);
      if (requestData) {
        requestData.response = {
          status: params.response.status,
          mimeType: params.response.mimeType,
          headers: params.response.headers
        };
        
        // Only process JSON responses
        if (params.response.mimeType === "application/json" || 
            (params.response.mimeType === "text/plain" && params.response.headers?.["content-type"]?.includes("json"))) {
          
          // Add a small delay to ensure the response body is available
          setTimeout(async () => {
            try {
              const response = await getResponseBodyWithRetry(debuggeeId, params.requestId);
              
              if (response?.body) {
                try {
                  // Preprocess and parse JSON
                  const cleanedJson = preprocessJsonString(response.body);
                  const parsedBody = JSON.parse(cleanedJson);
                  
                  // Generate schema
                  const schema = generateJsonSchema(parsedBody);
                  
                  // Store schema and clean response info
                  requestData.responseBody = {
                    data: parsedBody
                  };
                } catch (e) {
                  console.error("Failed to process response:", e);
                  requestData.responseBody = {
                    error: "Failed to process JSON response",
                    details: e instanceof Error ? e.message : String(e),
                    originalBody: response.body.slice(0, 1000) // Store first 1000 chars for debugging
                  };
                }
              } else {
                requestData.responseBody = {
                  error: "Failed to retrieve response body",
                  details: "Response body was not available or too large to process"
                };
              }
            } catch (e) {
              console.error("Failed to get response body:", e);
              requestData.responseBody = {
                error: "Failed to retrieve response body",
                details: e instanceof Error ? e.message : String(e)
              };
            }
          }, 100); // Small delay to ensure response is ready
        }
      }
      break;
  }
}

// Helper function to chunk large data
function chunkData(data: any[], chunkSize: number = 50): any[][] {
  const chunks: any[][] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
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
      startMonitoring(message.tabId, message.requestTypeFilter);
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
      const allRequests = Array.from(tabState.requests.entries()).map(([id, data]) => ({
        id,
        url: data.request.url,
        method: data.request.method,
        type: data.request.type,
        timestamp: data.timestamp,
        responseBody: data.responseBody,
      }));
      
      // Get chunk index from message or default to 0
      const chunkIndex = message.chunkIndex || 0;
      const chunks = chunkData(allRequests);
      
      sendResponse({
        requests: chunks[chunkIndex] || [],
        totalChunks: chunks.length,
        currentChunk: chunkIndex
      });
      break;

    case "CLEAR_REQUESTS":
      tabState.requests.clear();
      sendResponse({ success: true });
      break;
  }
  return true;
});
