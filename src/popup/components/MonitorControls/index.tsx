/** @jsxImportSource preact */
import "./styles.css";

type MonitorControlsProps = {
  isMonitoring: boolean;
  hasRequests: boolean;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
  onClearRequests: () => void;
};

export function MonitorControls({
  isMonitoring,
  hasRequests,
  onStartMonitoring,
  onStopMonitoring,
  onClearRequests
}: MonitorControlsProps) {
  return (
    <div class="controls">
      <button
        class="button"
        onClick={onStartMonitoring}
        disabled={isMonitoring}
      >
        Start Monitoring
      </button>
      <button
        class="button"
        onClick={onStopMonitoring}
        disabled={!isMonitoring}
      >
        Stop Monitoring
      </button>
      <button
        class="button"
        onClick={onClearRequests}
        disabled={!hasRequests}
      >
        Clear Requests
      </button>
    </div>
  );
} 