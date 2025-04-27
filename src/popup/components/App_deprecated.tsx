/** @jsxImportSource preact */
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { JSX } from "preact";
import { RequestList } from "./RequestList";
import { Preview } from "./Preview";
import { CustomJsonInput } from "./CustomJsonInput";
import { SchemaType, ViewMode } from "../types";

// Debounced filter function type
type DebouncedFunction = (value: string) => void;

function useDebounceCallback(callback: DebouncedFunction, delay: number): DebouncedFunction {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((value: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(value);
    }, delay);
  }, [callback, delay]);
}

// Minimal request data for list view
type RequestListItem = {
  id: string;
  url: string;
  method: string;
  timestamp: number;
};

type RequestTypeFilter = 'all' | 'fetch';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('monitor');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [requests, setRequests] = useState<any[]>([]); // Full request data
  const [requestListItems, setRequestListItems] = useState<RequestListItem[]>([]); // Minimal data for list
  const [filteredListItems, setFilteredListItems] = useState<RequestListItem[]>([]); // Filtered minimal data
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [schemaType, setSchemaType] = useState<SchemaType>("joi");
  const [filter, setFilter] = useState("");
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestTypeFilter>('fetch');
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(1);

  // Create filtered items updater
  const updateFilteredItems = useCallback((searchValue: string) => {
    if (!searchValue) {
      setFilteredListItems(requestListItems);
      return;
    }

    const lowerFilter = searchValue.toLowerCase();
    const filtered = requestListItems.reduce((acc, item) => {
      if (item.url.toLowerCase().includes(lowerFilter)) {
        acc.push(item);
      }
      return acc;
    }, [] as RequestListItem[]);

    setFilteredListItems(filtered);
  }, [requestListItems]);

  // Create debounced filter function
  const debouncedUpdateFilter = useDebounceCallback(updateFilteredItems, 300);

  // Handle input change with correct Preact event type
  const handleFilterChange = useCallback((e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
    const value = e.currentTarget.value;
    setFilter(value);
    debouncedUpdateFilter(value);
  }, [debouncedUpdateFilter]);

  // Function to extract minimal request data
  const createRequestListItem = (request: any): RequestListItem => ({
    id: request.id,
    url: request.url,
    method: request.method,
    timestamp: request.timestamp
  });

  // Function to fetch a specific chunk of requests
  const fetchRequestChunk = async (tabId: number, chunkIndex: number) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_REQUESTS",
        tabId,
        chunkIndex,
      });
      
      if (response.requests) {
        const newRequests = response.requests;
        const newListItems = newRequests.map(createRequestListItem);
        
        if (chunkIndex === 0) {
          setRequests(newRequests);
          setRequestListItems(newListItems);
          setFilteredListItems(newListItems);
        } else {
          setRequests(prev => [...prev, ...newRequests]);
          setRequestListItems(prev => [...prev, ...newListItems]);
          setFilteredListItems(prev => [...prev, ...newListItems]);
        }
        
        setTotalChunks(response.totalChunks);
        setCurrentChunk(response.currentChunk);
      }
    } catch (error) {
      console.error("Error fetching requests chunk:", error);
    }
  };

  // Handle preview selection with full request data
  const handlePreviewSelection = useCallback((listItem: RequestListItem) => {
    const fullRequest = requests.find(req => req.id === listItem.id);
    setSelectedRequest(fullRequest);
  }, [requests]);

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
      setRequestListItems([]);
      setFilteredListItems([]);
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
    setRequestListItems([]);
    setFilteredListItems([]);
    setSelectedRequest(null);
  };

  const handleClosePopup = () => {
    window.close();
  };

  return (
    <div class="container">
      <div class="sticky-header">
        <div class="header">
          <div class="view-mode-tabs">
            <button
              class={`view-mode-tab ${viewMode === 'monitor' ? 'active' : ''}`}
              onClick={() => setViewMode('monitor')}
            >
              Monitor Requests
            </button>
            <button
              class={`view-mode-tab ${viewMode === 'custom' ? 'active' : ''}`}
              onClick={() => setViewMode('custom')}
            >
              Custom JSON
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

        {viewMode === 'monitor' && (
          <>
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
                  onInput={handleFilterChange}
                  disabled={isMonitoring}
                />
              </div>
            </div>
          </>
        )}

        {viewMode === 'custom' && (
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
            </div>
          </div>
        )}
      </div>

      {viewMode === 'monitor' ? (
        <>
          <div class="request-list-container">
            <RequestList 
              requests={filteredListItems} 
              onPreview={handlePreviewSelection}
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
        </>
      ) : (
        <CustomJsonInput schemaType={schemaType} />
      )}
    </div>
  );
}
