import { SchemaType } from "../types";

interface SchemaDefinition {
  __type: string | string[];
  __properties?: Record<string, SchemaDefinition>;
  __items?: SchemaDefinition;
  __required?: string[];
  __isEmptyArray?: boolean;
  __isDate?: boolean;
}

function analyzeJsonStructure(data: any): SchemaDefinition {
  if (data === null) {
    return { __type: "null" };
  }

  if (data === undefined) {
    return { __type: "undefined" };
  }

  // Handle Date objects
  if (data instanceof Date) {
    return { __type: "date", __isDate: true };
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return {
        __type: "array",
        __isEmptyArray: true,
      };
    }

    // Sample more intelligently for large arrays
    const sampleSize = Math.min(data.length, 50);
    const step = Math.max(1, Math.floor(data.length / sampleSize));
    const itemSchemas: SchemaDefinition[] = [];

    for (let i = 0; i < data.length; i += step) {
      if (itemSchemas.length >= sampleSize) break;
      itemSchemas.push(analyzeJsonStructure(data[i]));
    }

    const mergedItemSchema =
      itemSchemas.length > 0 ? mergeSchemaDefinitions(itemSchemas) : null;

    return {
      __type: "array",
      ...(mergedItemSchema && { __items: mergedItemSchema }),
    };
  }

  if (typeof data === "object") {
    const __properties: Record<string, SchemaDefinition> = {};
    const __required: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("__")) {
        const schema = analyzeJsonStructure(value);
        __properties[key] = schema;
        // Only mark as required if the value is not undefined and not null and not an empty array
        if (
          value !== undefined &&
          value !== null &&
          !(Array.isArray(value) && value.length === 0)
        ) {
          __required.push(key);
        }
      }
    }

    return {
      __type: "object",
      __properties,
      __required,
    };
  }

  // Handle BigInt
  if (typeof data === "bigint") {
    return { __type: "bigint" };
  }

  const type =
    typeof data === "number" && Number.isInteger(data)
      ? "integer"
      : typeof data;
  return {
    __type: type,
  };
}

function mergeSchemaDefinitions(schemas: SchemaDefinition[]): SchemaDefinition {
  if (schemas.length === 0) {
    return { __type: "array", __isEmptyArray: true };
  }
  if (schemas.length === 1) return schemas[0];

  const types = new Set(
    schemas.flatMap((s) => (Array.isArray(s.__type) ? s.__type : [s.__type]))
  );

  if (types.size === 1) {
    const type = types.values().next().value;

    if (type === "object") {
      const allProperties = new Set(
        schemas.flatMap((s) => Object.keys(s.__properties || {}))
      );
      const __properties: Record<string, SchemaDefinition> = {};
      const __required: string[] = [];

      for (const prop of allProperties) {
        if (!prop.startsWith("__")) {
          const propSchemas = schemas
            .filter((s) => s.__properties?.[prop])
            .map((s) => s.__properties![prop]);

          if (propSchemas.length > 0) {
            __properties[prop] = mergeSchemaDefinitions(propSchemas);
            if (schemas.every((s) => s.__required?.includes(prop))) {
              __required.push(prop);
            }
          }
        }
      }

      return { __type: type, __properties, __required };
    }

    if (type === "array") {
      if (schemas.some((s) => s.__isEmptyArray)) {
        return { __type: "array", __isEmptyArray: true };
      }
      const itemSchemas = schemas
        .filter((s) => s.__items)
        .map((s) => s.__items!);
      const mergedItems =
        itemSchemas.length > 0 ? mergeSchemaDefinitions(itemSchemas) : null;
      return {
        __type: type,
        ...(mergedItems && { __items: mergedItems }),
      };
    }

    if (type === "date") {
      return { __type: "date", __isDate: true };
    }
  }

  return { __type: Array.from(types) };
}

// Helper function to create safe property keys for schema generation
function createSafePropertyKey(key: string): string {
  // Check if the key needs to be quoted
  const needsQuotes =
    !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ||
    ["if", "for", "while", "class", "const", "let", "var", "function"].includes(
      key
    );

  if (needsQuotes) {
    return `"${key.replace(/"/g, '\\"')}"`;
  }
  return key;
}

export function generateSchemaFromJson(
  data: any,
  type: SchemaType = "zod",
  indent = ""
): string {
  if (!data) {
    return type === "zod"
      ? "// Error: No response data available\nz.unknown()"
      : "// Error: No response data available\nJoi.any()";
  }

  if (data.error) {
    return `// Error: ${data.error}\n// ${data.details}\n${
      type === "zod" ? "z.unknown()" : "Joi.any()"
    }`;
  }

  const schema = analyzeJsonStructure(data);

  if (type === "zod") {
    return generateZodSchema(schema, indent);
  }
  return generateJoiSchema(schema, indent);
}

function generateZodSchema(schema: SchemaDefinition, indent = ""): string {
  if (!schema || !schema.__type) {
    return "z.unknown()";
  }

  const types = Array.isArray(schema.__type) ? schema.__type : [schema.__type];

  if (types.length > 1) {
    // Check if this is a nullable pattern (type + null)
    if (types.length === 2 && types.includes("null")) {
      const nonNullType = types.find((t) => t !== "null");
      if (nonNullType) {
        const baseSchema = generateZodSchema(
          { ...schema, __type: nonNullType },
          indent
        );
        return `${baseSchema}.nullable()`;
      }
    }

    const unionSchemas = types.map((type) =>
      generateZodSchema({ ...schema, __type: type }, indent)
    );
    return `z.union([${unionSchemas.join(", ")}])`;
  }

  const type = types[0];

  switch (type) {
    case "array": {
      if (schema.__isEmptyArray) {
        return "z.array(z.any())";
      }
      return schema.__items
        ? `z.array(${generateZodSchema(schema.__items, indent + "  ")})`
        : "z.array(z.any())";
    }
    case "null":
      return "z.null()";
    case "undefined":
      return "z.undefined()";
    case "string":
      return "z.string()";
    case "number":
      return "z.number()";
    case "integer":
      return "z.number().int()";
    case "boolean":
      return "z.boolean()";
    case "bigint":
      return "z.bigint()";
    case "date":
      return "z.date()";
    case "object": {
      if (
        !schema.__properties ||
        Object.keys(schema.__properties).length === 0
      ) {
        return "z.object({})";
      }

      const properties = Object.entries(schema.__properties)
        .filter(([key]) => !key.startsWith("__"))
        .map(([key, value]) => {
          const propSchema = generateZodSchema(value, indent + "  ");
          const isRequired = schema.__required?.includes(key);
          const safeKey = createSafePropertyKey(key);
          return `${indent}  ${safeKey}: ${propSchema}${
            isRequired ? "" : ".optional()"
          }`;
        })
        .join(",\n");
      return `z.object({\n${properties}\n${indent}})`;
    }
    case "unknown":
      return "z.unknown()";
    case "any":
      return "z.any()";
    default:
      return "z.unknown()";
  }
}

function generateJoiSchema(schema: SchemaDefinition, indent = ""): string {
  if (!schema || !schema.__type) {
    return "Joi.any()";
  }

  const types = Array.isArray(schema.__type) ? schema.__type : [schema.__type];

  if (types.length > 1) {
    // Check if this is a nullable pattern (type + null)
    if (types.length === 2 && types.includes("null")) {
      const nonNullType = types.find((t) => t !== "null");
      if (nonNullType) {
        const baseSchema = generateJoiSchema(
          { ...schema, __type: nonNullType },
          indent
        );
        return `${baseSchema}.allow(null)`;
      }
    }

    const alternativeSchemas = types.map((type) =>
      generateJoiSchema({ ...schema, __type: type }, indent)
    );
    return `Joi.alternatives().try(${alternativeSchemas.join(", ")})`;
  }

  const type = types[0];

  if (type === "array" || schema.__isEmptyArray) {
    if (schema.__isEmptyArray || !schema.__items) {
      return "Joi.array()";
    }
    return `Joi.array().items(${generateJoiSchema(
      schema.__items,
      indent + "  "
    )})`;
  }

  switch (type) {
    case "null":
      return "Joi.valid(null)";
    case "undefined":
      return "Joi.valid(undefined)";
    case "string":
      return "Joi.string()";
    case "number":
      return "Joi.number()";
    case "integer":
      return "Joi.number().integer()";
    case "boolean":
      return "Joi.boolean()";
    case "bigint":
      return "Joi.number().unsafe()"; // Joi doesn't have native BigInt support
    case "date":
      return "Joi.date()";
    case "object": {
      if (
        !schema.__properties ||
        Object.keys(schema.__properties).length === 0
      ) {
        return "Joi.object()";
      }

      const properties = Object.entries(schema.__properties)
        .filter(([key]) => !key.startsWith("__"))
        .map(([key, value]) => {
          const propSchema = generateJoiSchema(value, indent + "  ");
          const isRequired = schema.__required?.includes(key);
          const safeKey = createSafePropertyKey(key);
          return `${indent}  ${safeKey}: ${propSchema}${
            isRequired ? ".required()" : ""
          }`;
        })
        .join(",\n");
      return `Joi.object({\n${properties}\n${indent}})`;
    }
    case "unknown":
      return "Joi.any()";
    case "any":
      return "Joi.any()";
    default:
      return "Joi.any()";
  }
}
