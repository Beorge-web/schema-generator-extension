/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";
import { RequestList } from "./RequestList";
import { Preview } from "./Preview";
import { SchemaType } from "../types";

type RequestTypeFilter = 'all' | 'fetch';

export function App() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [schemaType, setSchemaType] = useState<SchemaType>("joi");
  const [filter, setFilter] = useState("");
  const [filteredRequests, setFilteredRequests] = useState<any[]>([]);
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestTypeFilter>('fetch');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(1);

  // Function to fetch a specific chunk of requests
  const fetchRequestChunk = async (tabId: number, chunkIndex: number) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_REQUESTS",
        tabId,
        chunkIndex,
      });
      
      if (response.requests) {
        if (chunkIndex === 0) {
          setRequests(response.requests);
        } else {
          setRequests(prev => [...prev, ...response.requests]);
        }
        setTotalChunks(response.totalChunks);
        setCurrentChunk(response.currentChunk);
      }
    } catch (error) {
      console.error("Error fetching requests chunk:", error);
    }
  };

  // Separate effect for filtering to avoid unnecessary work during monitoring updates
  useEffect(() => {
    if (!filter) {
      setFilteredRequests(requests);
      return;
    }
    const lowerFilter = filter.toLowerCase();
    const filtered = requests.filter((request) => 
      request.url.toLowerCase().includes(lowerFilter)
    );
    setFilteredRequests(filtered);
  }, [filter, requests]);

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
          // Get first chunk of requests
          await fetchRequestChunk(tabId, 0);
        }
      }
    });

    return () => {
      setRequests([]);
      setSelectedRequest(null);
      setCurrentChunk(0);
      setTotalChunks(1);
    };
  }, []);

  useEffect(() => {
    let intervalId: number;

    if (isMonitoring && currentTabId) {
      const updateRequests = async () => {
        await fetchRequestChunk(currentTabId, 0);
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

  // Load more requests when scrolling
  const handleLoadMore = useCallback(async () => {
    if (currentTabId && currentChunk < totalChunks - 1) {
      await fetchRequestChunk(currentTabId, currentChunk + 1);
    }
  }, [currentTabId, currentChunk, totalChunks]);

  const handleStartMonitoring = async () => {
    if (!currentTabId) return;

    const response = await chrome.runtime.sendMessage({
      type: "START_MONITORING",
      tabId: currentTabId,
      requestTypeFilter,
    });

    if (response.success) {
      setIsMonitoring(true);
      setRequests([]); // Clear requests when starting
      setSelectedRequest(null);
      setCurrentChunk(0);
      setTotalChunks(1);
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
  };

  const handleClosePopup = () => {
    window.close();
  };

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
          <div class="filters-row">
            <div class="schema-type">
              <label>Schema Type:</label>
              <select
                value={schemaType}
                onChange={(e) => setSchemaType(e.currentTarget.value as SchemaType)}
              >
                <option value="joi">Joi</option>
                <option value="zod">Zod</option>
              </select>
            </div>
            <div class="request-type">
              <label>Monitor:</label>
              <select
                value={requestTypeFilter}
                onChange={(e) => setRequestTypeFilter(e.currentTarget.value as RequestTypeFilter)}
                disabled={isMonitoring}
              >
                <option value="fetch">Fetch/XHR</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          <div class="filter-input">
            <input
              type="text"
              placeholder="Filter by URL..."
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
              disabled={isMonitoring}
            />
          </div>
        </div>
      </div>

      <div class="request-list-container">
        <RequestList 
          requests={filteredRequests} 
          onPreview={setSelectedRequest}
          onLoadMore={handleLoadMore}
          hasMore={currentChunk < totalChunks - 1}
        />
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
