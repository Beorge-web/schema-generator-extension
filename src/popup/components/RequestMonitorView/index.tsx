/** @jsxImportSource preact */
import { SchemaType } from "../../types/common";
import { RequestListItem, RequestTypeFilter } from "../../types/request";
import { MonitorControls } from "../MonitorControls";
import { FilterControls } from "../FilterControls";
import { Preview } from "../Preview";
import "./styles.css";
import { RequestList } from "../RequestList";

type RequestMonitorViewProps = {
  isMonitoring: boolean;
  schemaType: SchemaType;
  requestTypeFilter: RequestTypeFilter;
  filter: string;
  filteredRequests: RequestListItem[];
  fullRequests: any[];
  selectedRequest: any;
  currentChunk: number;
  totalChunks: number;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
  onClearRequests: () => void;
  onSchemaTypeChange: (type: SchemaType) => void;
  onRequestTypeFilterChange: (type: RequestTypeFilter) => void;
  onFilterChange: (e: any) => void;
  onPreviewSelect: (request: any) => void;
  onPreviewClose: () => void;
  onLoadMore: () => void;
};

export function RequestMonitorView({
  isMonitoring,
  schemaType,
  requestTypeFilter,
  filter,
  filteredRequests,
  fullRequests,
  selectedRequest,
  currentChunk,
  totalChunks,
  onStartMonitoring,
  onStopMonitoring,
  onClearRequests,
  onSchemaTypeChange,
  onRequestTypeFilterChange,
  onFilterChange,
  onPreviewSelect,
  onPreviewClose,
  onLoadMore,
}: RequestMonitorViewProps) {
  const handlePreviewSelect = (listItem: RequestListItem) => {
    const fullRequest = fullRequests.find(req => req.id === listItem.id);
    if (fullRequest) {
      onPreviewSelect(fullRequest);
    }
  };

  return (
    <>
      <MonitorControls
        isMonitoring={isMonitoring}
        hasRequests={filteredRequests.length > 0}
        onStartMonitoring={onStartMonitoring}
        onStopMonitoring={onStopMonitoring}
        onClearRequests={onClearRequests}
      />
      <FilterControls
        schemaType={schemaType}
        requestTypeFilter={requestTypeFilter}
        filter={filter}
        isMonitoring={isMonitoring}
        onSchemaTypeChange={onSchemaTypeChange}
        onRequestTypeFilterChange={onRequestTypeFilterChange}
        onFilterChange={onFilterChange}
      />
      <div class="request-list-container">
        <RequestList
          requests={filteredRequests}
          onPreview={handlePreviewSelect}
          onLoadMore={onLoadMore}
          hasMore={currentChunk < totalChunks - 1}
        />
      </div>
      {selectedRequest && (
        <Preview
          request={selectedRequest}
          schemaType={schemaType}
          onClose={onPreviewClose}
        />
      )}
    </>
  );
} 