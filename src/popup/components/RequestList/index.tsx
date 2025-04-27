/** @jsxImportSource preact */
import { useRef, useEffect } from "preact/hooks";
import { RequestListItem } from "../../types/request";
import "./styles.css";

type RequestListProps = {
  requests: RequestListItem[];
  onPreview: (request: RequestListItem) => void;
  onLoadMore: () => void;
  hasMore: boolean;
};

export function RequestList({ requests, onPreview, onLoadMore, hasMore }: RequestListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const options = {
      root: listRef.current,
      rootMargin: '20px',
      threshold: 0.1,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore) {
        onLoadMore();
      }
    }, options);

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onLoadMore, hasMore]);

  return (
    <div class="request-list" ref={listRef}>
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
      {hasMore && (
        <div ref={loadingRef} class="loading-indicator">
          Loading more...
        </div>
      )}
    </div>
  );
} 