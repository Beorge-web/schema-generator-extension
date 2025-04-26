/** @jsxImportSource preact */
import { useState, useEffect } from "preact/hooks";
import { RequestList } from "./RequestList";
import { Preview } from "./Preview";
import { SchemaType } from "../types";

export function App() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [schemaType, setSchemaType] = useState<SchemaType>("joi");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    // Get current tab and monitoring state when popup opens
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        const tabId = tabs[0].id;
        setCurrentTabId(tabId);

        // Get current monitoring state for this specific tab
        const response = await chrome.runtime.sendMessage({
          type: "GET_MONITORING_STATE",
          tabId,
        });
        
        if (response.monitoringState) {
          setIsMonitoring(response.monitoringState.isMonitoring);
          // Get requests for this specific tab
          const requestsResponse = await chrome.runtime.sendMessage({
            type: "GET_REQUESTS",
            tabId,
          });
          if (requestsResponse.requests) {
            setRequests(requestsResponse.requests);
          }
        }
      }
    });

    // Cleanup function
    return () => {
      setRequests([]);
      setSelectedRequest(null);
      setFilter("");
    };
  }, []);

  useEffect(() => {
    let intervalId: number;

    if (isMonitoring && currentTabId) {
      const updateRequests = async () => {
        const response = await chrome.runtime.sendMessage({
          type: "GET_REQUESTS",
          tabId: currentTabId,
        });
        if (response.requests) {
          setRequests(response.requests);
        }
      };

      updateRequests();
      intervalId = window.setInterval(updateRequests, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isMonitoring, currentTabId]);

  const handleStartMonitoring = async () => {
    if (!currentTabId) return;

    const response = await chrome.runtime.sendMessage({
      type: "START_MONITORING",
      tabId: currentTabId,
    });

    if (response.success) {
      setIsMonitoring(true);
      setRequests([]); // Clear requests when starting
      setSelectedRequest(null);
      setFilter("");
    }
  };

  const handleStopMonitoring = async () => {
    if (!currentTabId) return;

    const response = await chrome.runtime.sendMessage({
      type: "STOP_MONITORING",
      tabId: currentTabId,
    });

    if (response.success) {
      setIsMonitoring(false);
    }
  };

  const handleClearRequests = () => {
    if (!currentTabId) return;

    chrome.runtime.sendMessage({
      type: "CLEAR_REQUESTS",
      tabId: currentTabId,
    });
    
    setRequests([]);
    setSelectedRequest(null);
    setFilter("");
  };

  const handleClosePopup = () => {
    window.close();
  };

  const filteredRequests = requests.filter(
    (request) =>
      request.url.toLowerCase().includes(filter.toLowerCase()) ||
      request.method.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div class="container">
      <div class="sticky-header">
        <div class="header">
          <div class="controls">
            <button
              class="button button-primary"
              onClick={handleStartMonitoring}
              disabled={isMonitoring}
            >
              Start Monitoring
            </button>
            <button
              class="button button-secondary"
              onClick={handleStopMonitoring}
              disabled={!isMonitoring}
            >
              Stop Monitoring
            </button>
            <button
              class="button button-secondary"
              onClick={handleClearRequests}
              disabled={!requests.length}
            >
              Clear Requests
            </button>
          </div>
          <button 
            class="close-button" 
            onClick={handleClosePopup}
            title="Close popup"
          >
            ×
          </button>
        </div>

        <div class="filters">
          <div class="schema-type">
            <label htmlFor="schemaType">Schema Type:</label>
            <select
              id="schemaType"
              value={schemaType}
              onChange={(e) => setSchemaType(e.currentTarget.value as SchemaType)}
            >
              <option value="joi">Joi</option>
              <option value="zod">Zod</option>
            </select>
          </div>
          <div class="filter-input">
            <input
              type="text"
              placeholder="Filter requests..."
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
            />
          </div>
        </div>
      </div>

      <div class="request-list-container">
        <RequestList requests={filteredRequests} onPreview={setSelectedRequest} />
      </div>

      {selectedRequest && (
        <Preview
          request={selectedRequest}
          schemaType={schemaType}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}
