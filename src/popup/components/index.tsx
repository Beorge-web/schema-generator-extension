/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from "preact/hooks";
import { JSX } from "preact";
import { SchemaType, ViewMode } from "../types/common";
import { RequestListItem, RequestTypeFilter } from "../types/request";
import { useDebounceCallback } from "../hooks/useDebounceCallback";
import { Header } from "./Header";
import { RequestMonitorView } from "./RequestMonitorView";
import { CustomJsonView } from "./CustomJsonView/index";
import "./styles.css";

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("monitor");
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [requests, setRequests] = useState<any[]>([]); // Full request data
  const [requestListItems, setRequestListItems] = useState<RequestListItem[]>(
    []
  ); // Minimal data for list
  const [filteredListItems, setFilteredListItems] = useState<RequestListItem[]>(
    []
  ); // Filtered minimal data
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [schemaType, setSchemaType] = useState<SchemaType>("joi");
  const [filter, setFilter] = useState("");
  const [requestTypeFilter, setRequestTypeFilter] =
    useState<RequestTypeFilter>("fetch");
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(1);

  // Create filtered items updater
  const updateFilteredItems = useCallback(
    (searchValue: string) => {
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
    },
    [requestListItems]
  );

  // Create debounced filter function
  const debouncedUpdateFilter = useDebounceCallback(updateFilteredItems, 300);

  // Handle input change with correct Preact event type
  const handleFilterChange = useCallback(
    (e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
      const value = e.currentTarget.value;
      setFilter(value);
      debouncedUpdateFilter(value);
    },
    [debouncedUpdateFilter]
  );

  // Function to extract minimal request data
  const createRequestListItem = (request: any): RequestListItem => ({
    id: request.id,
    url: request.url,
    method: request.method,
    timestamp: request.timestamp,
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
          setRequests((prev) => [...prev, ...newRequests]);
          setRequestListItems((prev) => [...prev, ...newListItems]);
          setFilteredListItems((prev) => [...prev, ...newListItems]);
        }

        setTotalChunks(response.totalChunks);
        setCurrentChunk(response.currentChunk);
      }
    } catch (error) {
      console.error("Error fetching requests chunk:", error);
    }
  };

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
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onClose={handleClosePopup}
      />
      <div class="content">
        {viewMode === "monitor" && (
          <RequestMonitorView
            isMonitoring={isMonitoring}
            schemaType={schemaType}
            requestTypeFilter={requestTypeFilter}
            filter={filter}
            filteredRequests={filteredListItems}
            fullRequests={requests}
            selectedRequest={selectedRequest}
            currentChunk={currentChunk}
            totalChunks={totalChunks}
            onStartMonitoring={handleStartMonitoring}
            onStopMonitoring={handleStopMonitoring}
            onClearRequests={handleClearRequests}
            onSchemaTypeChange={setSchemaType}
            onRequestTypeFilterChange={setRequestTypeFilter}
            onFilterChange={handleFilterChange}
            onPreviewSelect={setSelectedRequest}
            onPreviewClose={() => setSelectedRequest(null)}
            onLoadMore={() =>
              fetchRequestChunk(currentTabId!, currentChunk + 1)
            }
          />
        )}

        {viewMode === "custom" && (
          <CustomJsonView
            onSchemaTypeChange={setSchemaType}
            schemaType={schemaType}
          />
        )}
      </div>
    </div>
  );
}
