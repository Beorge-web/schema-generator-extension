import { SchemaType } from "./common";

// Minimal request data for list view
export type RequestListItem = {
  id: string;
  url: string;
  method: string;
  timestamp: number;
};

export type RequestTypeFilter = 'all' | 'fetch';

// Props types for components
export type PreviewProps = {
  request: any;
  schemaType: SchemaType;
  onClose: () => void;
};

export type RequestListProps = {
  requests: RequestListItem[];
  onPreview: (request: RequestListItem) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}; 