import { SchemaType } from '../types';

interface SchemaOptions {
  showExamples?: boolean;
}

interface SchemaDefinition {
  __type: string | string[];
  __properties?: Record<string, SchemaDefinition>;
  __items?: SchemaDefinition;
  __required?: string[];
  __example?: any;
  __examples?: any[];
}

function analyzeJsonStructure(data: any): SchemaDefinition {
  if (data === null) {
    return { __type: 'null' };
  }

  if (Array.isArray(data)) {
    const itemSchemas = data.slice(0, 10).map(item => analyzeJsonStructure(item));
    const mergedItemSchema = itemSchemas.length > 0 
      ? mergeSchemaDefinitions(itemSchemas)
      : { __type: 'any' };
    
    return {
      __type: 'array',
      __items: mergedItemSchema,
      __example: data.length > 10 ? `Array(${data.length})` : undefined
    };
  }

  if (typeof data === 'object') {
    const __properties: Record<string, SchemaDefinition> = {};
    const __required: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith('__')) {
        __properties[key] = analyzeJsonStructure(value);
        if (value !== undefined) {
          __required.push(key);
        }
      }
    }

    return {
      __type: 'object',
      __properties,
      __required
    };
  }

  const type = typeof data === 'number' && Number.isInteger(data) ? 'integer' : typeof data;
  return {
    __type: type,
    __example: ['string', 'number', 'boolean'].includes(type) ? data : undefined
  };
}

function mergeSchemaDefinitions(schemas: SchemaDefinition[]): SchemaDefinition {
  if (schemas.length === 0) return { __type: 'any' };
  if (schemas.length === 1) return schemas[0];

  const types = new Set(schemas.flatMap(s => Array.isArray(s.__type) ? s.__type : [s.__type]));
  
  if (types.size === 1) {
    const type = types.values().next().value;
    
    if (type === 'object') {
      const allProperties = new Set(schemas.flatMap(s => Object.keys(s.__properties || {})));
      const __properties: Record<string, SchemaDefinition> = {};
      const __required: string[] = [];

      for (const prop of allProperties) {
        if (!prop.startsWith('__')) {
          const propSchemas = schemas
            .filter(s => s.__properties?.[prop])
            .map(s => s.__properties![prop]);
          
          if (propSchemas.length > 0) {
            __properties[prop] = mergeSchemaDefinitions(propSchemas);
            if (schemas.every(s => s.__required?.includes(prop))) {
              __required.push(prop);
            }
          }
        }
      }

      return { __type: type, __properties, __required };
    }

    if (type === 'array') {
      const itemSchemas = schemas.filter(s => s.__items).map(s => s.__items!);
      return {
        __type: type,
        __items: itemSchemas.length > 0 ? mergeSchemaDefinitions(itemSchemas) : { __type: 'any' }
      };
    }
  }

  return { __type: Array.from(types) };
}

export function generateSchemaFromJson(
  data: any, 
  type: SchemaType = 'zod', 
  indent = '',
  options: SchemaOptions = {}
): string {
  if (!data) {
    return type === 'zod' 
      ? '// Error: No response data available\nz.unknown()'
      : '// Error: No response data available\nJoi.any()';
  }

  if (data.error) {
    return `// Error: ${data.error}\n// ${data.details}\n${type === 'zod' ? 'z.unknown()' : 'Joi.any()'}`;
  }

  // If we receive a schema with metadata fields, extract just the data
  let schemaData = data;
  if (data.schema && typeof data.schema === 'object') {
    // Extract the actual data structure from the schema metadata
    schemaData = extractDataFromSchema(data.schema);
  } else if (data.sample) {
    schemaData = data.sample;
  }

  // Generate fresh schema from the cleaned data
  const schema = analyzeJsonStructure(schemaData);
  
  if (type === 'zod') {
    return generateZodSchema(schema, indent, options);
  }
  return generateJoiSchema(schema, indent, options);
}

// Helper function to extract actual data structure from schema metadata
function extractDataFromSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // If this is a schema object with metadata
  if (schema.__type) {
    if (schema.__type === 'object' && schema.__properties) {
      const result: any = {};
      for (const [key, value] of Object.entries(schema.__properties)) {
        result[key] = extractDataFromSchema(value);
      }
      return result;
    }
    if (schema.__type === 'array' && schema.__items) {
      return [extractDataFromSchema(schema.__items)];
    }
    // For primitive types, return a representative value
    switch (schema.__type) {
      case 'string': return schema.__example || '';
      case 'number': return schema.__example || 0;
      case 'boolean': return schema.__example || false;
      case 'null': return null;
      default: return undefined;
    }
  }

  // If it's an array
  if (Array.isArray(schema)) {
    return schema.map(item => extractDataFromSchema(item));
  }

  // If it's an object without metadata
  if (typeof schema === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(schema)) {
      if (!key.startsWith('__')) {
        result[key] = extractDataFromSchema(value);
      }
    }
    return result;
  }

  return schema;
}

function generateZodSchema(schema: SchemaDefinition, indent = '', options: SchemaOptions = {}): string {
  if (!schema || !schema.__type) {
    return 'z.unknown()';
  }

  const types = Array.isArray(schema.__type) ? schema.__type : [schema.__type];
  
  if (types.length > 1) {
    return types.map(type => generateZodSchema({ ...schema, __type: type }, indent, options)).join(' || ');
  }

  const type = types[0];
  const addExample = (base: string, example: any) => {
    if (!options.showExamples || example === undefined) return base;
    return `${base} // example: ${typeof example === 'string' ? `"${example}"` : example}`;
  };
  
  switch (type) {
    case 'array': {
      const items = schema.__items ? generateZodSchema(schema.__items, indent + '  ', options) : 'z.unknown()';
      let result = `z.array(${items})`;
      if (options.showExamples && schema.__example) {
        result += ` // ${schema.__example}`;
      }
      return result;
    }
    case 'null':
      return 'z.null()';
    case 'string':
      return addExample('z.string()', schema.__example);
    case 'number':
      return addExample('z.number()', schema.__example);
    case 'integer':
      return addExample('z.number().int()', schema.__example);
    case 'boolean':
      return addExample('z.boolean()', schema.__example);
    case 'object': {
      if (!schema.__properties || Object.keys(schema.__properties).length === 0) {
        return 'z.object({})';
      }

      const properties = Object.entries(schema.__properties)
        .filter(([key]) => !key.startsWith('__'))
        .map(([key, value]) => {
          const propSchema = generateZodSchema(value, indent + '  ', options);
          const isRequired = schema.__required?.includes(key);
          return `${indent}  ${key}: ${propSchema}${isRequired ? '' : '.optional()'}`;
        })
        .join(',\n');
      return `z.object({\n${properties}\n${indent}})`;
    }
    case 'any':
      return 'z.any()';
    default:
      return 'z.unknown()';
  }
}

function generateJoiSchema(schema: SchemaDefinition, indent = '', options: SchemaOptions = {}): string {
  if (!schema || !schema.__type) {
    return 'Joi.any()';
  }

  const types = Array.isArray(schema.__type) ? schema.__type : [schema.__type];
  
  if (types.length > 1) {
    return types.map(type => generateJoiSchema({ ...schema, __type: type }, indent, options)).join('.or(');
  }

  const type = types[0];
  const addExample = (base: string, example: any) => {
    if (!options.showExamples || example === undefined) return base;
    return `${base} // example: ${typeof example === 'string' ? `"${example}"` : example}`;
  };
  
  switch (type) {
    case 'array': {
      const items = schema.__items ? generateJoiSchema(schema.__items, indent + '  ', options) : 'Joi.any()';
      let result = `Joi.array().items(${items})`;
      if (options.showExamples && schema.__example) {
        result += ` // ${schema.__example}`;
      }
      return result;
    }
    case 'null':
      return 'Joi.valid(null)';
    case 'string':
      return addExample('Joi.string()', schema.__example);
    case 'number':
      return addExample('Joi.number()', schema.__example);
    case 'integer':
      return addExample('Joi.number().integer()', schema.__example);
    case 'boolean':
      return addExample('Joi.boolean()', schema.__example);
    case 'object': {
      if (!schema.__properties || Object.keys(schema.__properties).length === 0) {
        return 'Joi.object()';
      }

      const properties = Object.entries(schema.__properties)
        .filter(([key]) => !key.startsWith('__'))
        .map(([key, value]) => {
          const propSchema = generateJoiSchema(value, indent + '  ', options);
          const isRequired = schema.__required?.includes(key);
          return `${indent}  ${key}: ${propSchema}${isRequired ? '.required()' : ''}`;
        })
        .join(',\n');
      return `Joi.object({\n${properties}\n${indent}})`;
    }
    case 'any':
      return 'Joi.any()';
    default:
      return 'Joi.any()';
  }
} 