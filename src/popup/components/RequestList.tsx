/** @jsxImportSource preact */
interface RequestListProps {
  requests: any[];
  onPreview: (request: any) => void;
}

export function RequestList({ requests, onPreview }: RequestListProps) {
  return (
    <div class="request-list">
      {requests.map(request => (
        <div 
          class="request-item" 
          key={request.id}
          onClick={() => onPreview(request)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onPreview(request);
            }
          }}
        >
          <span class="method">{request.method}</span>
          <div class="url">{request.url}</div>
        </div>
      ))}
    </div>
  );
} 