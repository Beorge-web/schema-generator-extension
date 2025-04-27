/** @jsxImportSource preact */
import { JSX } from "preact";
import { SchemaType } from "../../types/common";
import { RequestTypeFilter } from "../../types/request";
import "./styles.css";

type FilterControlsProps = {
  schemaType: SchemaType;
  requestTypeFilter: RequestTypeFilter;
  filter: string;
  isMonitoring: boolean;
  onSchemaTypeChange: (type: SchemaType) => void;
  onRequestTypeFilterChange: (type: RequestTypeFilter) => void;
  onFilterChange: (e: JSX.TargetedEvent<HTMLInputElement, Event>) => void;
};

export function FilterControls({
  schemaType,
  requestTypeFilter,
  filter,
  isMonitoring,
  onSchemaTypeChange,
  onRequestTypeFilterChange,
  onFilterChange
}: FilterControlsProps) {
  return (
    <div class="filters">
      <div class="filters-row">
        <div class="schema-type">
          <label>Schema Type:</label>
          <select
            value={schemaType}
            onChange={(e) => onSchemaTypeChange(e.currentTarget.value as SchemaType)}
          >
            <option value="joi">Joi</option>
            <option value="zod">Zod</option>
          </select>
        </div>
        <div class="request-type">
          <label>Monitor:</label>
          <select
            value={requestTypeFilter}
            onChange={(e) => onRequestTypeFilterChange(e.currentTarget.value as RequestTypeFilter)}
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
          onInput={onFilterChange}
          disabled={isMonitoring}
        />
      </div>
    </div>
  );
} 