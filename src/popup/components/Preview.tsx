/** @jsxImportSource preact */
import { useState } from "preact/hooks";
import { SchemaType } from "../types";
import { generateSchemaFromJson } from "../utils/schema";

interface PreviewProps {
  request: any;
  schemaType: SchemaType;
  onClose: () => void;
}

type Tab = "schema" | "response";

export function Preview({ request, schemaType, onClose }: PreviewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("schema");
  const [copyStatus, setCopyStatus] = useState("Copy");

  const getContent = () => {
    if (activeTab === "schema") {
      return generateSchemaFromJson(request.responseBody, schemaType);
    }
    return JSON.stringify(request.responseBody, null, 2);
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
        <h3 class="preview-title">Preview</h3>
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
