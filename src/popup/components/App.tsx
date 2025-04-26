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
  const [schemaType, setSchemaType] = useState<SchemaType>("zod");

  useEffect(() => {
    // Get current tab and monitoring state when popup opens
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        setCurrentTabId(tabs[0].id);

        // Get current monitoring state
        const response = await chrome.runtime.sendMessage({
          type: "GET_MONITORING_STATE",
        });
        if (response.monitoringState) {
          setIsMonitoring(response.monitoringState.isMonitoring);
        }
      }
    });
  }, []);

  useEffect(() => {
    let intervalId: number;

    if (isMonitoring) {
      const updateRequests = async () => {
        const response = await chrome.runtime.sendMessage({
          type: "GET_REQUESTS",
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
  }, [isMonitoring]);

  const handleStartMonitoring = async () => {
    if (!currentTabId) return;

    const response = await chrome.runtime.sendMessage({
      type: "START_MONITORING",
      tabId: currentTabId,
    });

    if (response.success) {
      setIsMonitoring(true);
      setRequests([]); // Clear requests when starting
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

  const handleClosePopup = () => {
    window.close();
  };

  return (
    <div class="container">
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
        </div>
        <button 
          class="close-button" 
          onClick={handleClosePopup}
          title="Close popup"
        >
          ×
        </button>
      </div>

      <div class="schema-type">
        <label htmlFor="schemaType">Schema Type:</label>
        <select
          id="schemaType"
          value={schemaType}
          onChange={(e) => setSchemaType(e.currentTarget.value as SchemaType)}
        >
          <option value="zod">Zod</option>
          <option value="joi">Joi</option>
        </select>
      </div>

      <RequestList requests={requests} onPreview={setSelectedRequest} />

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
