/** @jsxImportSource preact */
interface RequestListProps {
  requests: any[];
  onPreview: (request: any) => void;
}

export function RequestList({ requests, onPreview }: RequestListProps) {
  return (
    <div class="request-list">
      {requests.map(request => (
        <div class="request-item" key={request.id}>
          <span class="method">{request.method}</span>
          <div class="url">{request.url}</div>
          <button 
            class="preview-btn"
            onClick={() => onPreview(request)}
          >
            Preview
          </button>
        </div>
      ))}
    </div>
  );
} 