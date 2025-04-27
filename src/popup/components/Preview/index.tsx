/** @jsxImportSource preact */
import { useState, useCallback } from "preact/hooks";
import { SchemaType } from "../../types/common";
import "./styles.css";
import { generateSchemaFromJson } from "../../utils/schema";

type PreviewProps = {
  request: any;
  schemaType: SchemaType;
  onClose: () => void;
};

type Tab = 'request' | 'response' | 'schema';

export function Preview({ request, schemaType, onClose }: PreviewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("schema");
  const [copyStatus, setCopyStatus] = useState("Copy");

  // Function to format URL by removing origin
  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      return url; // Return original if URL is invalid
    }
  };

  const getContent = () => {
    // Check if we have a parsing error
    if (request.responseBody?.error) {
      if (activeTab === "schema") {
        return `// Error: Unable to generate schema\n// ${request.responseBody.error}\n// ${request.responseBody.details}`;
      }
      return `// Original response body (failed to parse as JSON):\n${request.responseBody.originalBody}`;
    }

    if (activeTab === "schema") {
      try {
        return generateSchemaFromJson(request.responseBody.data, schemaType, '');
      } catch (e) {
        return `// Error: Failed to generate schema\n// ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    return JSON.stringify(request.responseBody.data, null, 2);
  };

  const handleCopy = async () => {
    const content = getContent();
    await navigator.clipboard.writeText(content);
    setCopyStatus("Copied!");
    setTimeout(() => setCopyStatus("Copy"), 1500);
  };

  return (
    <div class="preview-container">
      <div class="preview-header">
        <div class="preview-header-info">
          <div class="request-url">
            <span class="url-path">{formatUrl(request.url)}</span>
            {request.responseBody?.error && (
              <span class="error-badge" title={request.responseBody.details}>
                Failed to parse JSON
              </span>
            )}
          </div>
        </div>
        <div class="preview-header-actions">
          <button onClick={handleCopy}>{copyStatus}</button>
          <button onClick={onClose} class="secondary-button">Close</button>
        </div>
      </div>

      <div class="preview-tabs">
        <button
          class={`preview-tab ${activeTab === "schema" ? "active" : ""}`}
          onClick={() => setActiveTab("schema")}
        >
          Schema
        </button>
        <button
          class={`preview-tab ${activeTab === "response" ? "active" : ""}`}
          onClick={() => setActiveTab("response")}
        >
          Response
        </button>
      </div>

      <div class="preview-content">
        <pre>{getContent()}</pre>
      </div>
    </div>
  );
}
