/** @jsxImportSource preact */
import { ViewMode } from "../../types/common";
import "./styles.css";

type HeaderProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onClose: () => void;
};

export function Header({ viewMode, onViewModeChange, onClose }: HeaderProps) {
  return (
    <div class="header">
      <div class="view-mode-tabs">
        <button
          class={`view-mode-tab ${viewMode === 'monitor' ? 'active' : ''}`}
          onClick={() => onViewModeChange('monitor')}
        >
          Monitor Requests
        </button>
        <button
          class={`view-mode-tab ${viewMode === 'custom' ? 'active' : ''}`}
          onClick={() => onViewModeChange('custom')}
        >
          Custom JSON
        </button>
      </div>
      <button 
        class="close-button" 
        onClick={onClose}
        title="Close popup"
      >
        ×
      </button>
    </div>
  );
} 