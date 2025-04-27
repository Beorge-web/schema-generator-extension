/** @jsxImportSource preact */
import { useState, useCallback } from "preact/hooks";
import { SchemaType } from "../../types/common";
import "./styles.css";
import { generateSchemaFromJson } from "./../../utils/schema";

type CustomJsonViewProps = {
  schemaType: SchemaType;
  onSchemaTypeChange: (schemaType: SchemaType) => void;
};

export function CustomJsonView({
  schemaType,
  onSchemaTypeChange,
}: CustomJsonViewProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [generatedSchema, setGeneratedSchema] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [copyStatus, setCopyStatus] = useState("Copy");

  const handleGenerateSchema = () => {
    try {
      const parsedJson = JSON.parse(jsonInput);
      const schema = generateSchemaFromJson(parsedJson, schemaType, "", {
        showExamples,
      });
      setGeneratedSchema(schema);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON input");
      setGeneratedSchema("");
    }
  };

  const handleCopy = async () => {
    if (generatedSchema) {
      await navigator.clipboard.writeText(generatedSchema);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus("Copy"), 1500);
    }
  };

  return (
    <div class="custom-json-container">
      <div class="input-section">
        <div class="input-header">
          <h3>Input JSON</h3>
          <div class="schema-type">
            <label>Type:</label>
            <select
              value={schemaType}
              onChange={(e) =>
                onSchemaTypeChange(e.currentTarget.value as SchemaType)
              }
            >
              <option value="joi">Joi</option>
              <option value="zod">Zod</option>
            </select>
          </div>
          <label class="example-toggle">
            <input
              type="checkbox"
              checked={showExamples}
              onChange={(e) => setShowExamples(e.currentTarget.checked)}
            />
            Show Examples
          </label>
        </div>
        <textarea
          value={jsonInput}
          onInput={(e) => setJsonInput(e.currentTarget.value)}
          placeholder="Paste your JSON here..."
          class="json-input"
          spellcheck={false}
        />
        <button
          onClick={handleGenerateSchema}
          class="button button-primary generate-btn"
          disabled={!jsonInput.trim()}
        >
          Generate Schema
        </button>
      </div>

      {error && <div class="error-message">{error}</div>}

      {generatedSchema && (
        <div class="output-section">
          <div class="output-header">
            <h3>Generated Schema</h3>
            <button onClick={handleCopy} class="button button-secondary">
              {copyStatus}
            </button>
          </div>
          <pre class="schema-output">{generatedSchema}</pre>
        </div>
      )}
    </div>
  );
}
