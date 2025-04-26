import { SchemaType } from '../types';

interface SchemaOptions {
  showExamples?: boolean;
}

interface SchemaDefinition {
  type: string | string[];
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
  required?: string[];
  example?: any;
}

function analyzeJsonStructure(data: any): SchemaDefinition {
  if (data === null) {
    return { type: 'null' };
  }

  if (Array.isArray(data)) {
    const itemSchemas = data.slice(0, 10).map(item => analyzeJsonStructure(item));
    const mergedItemSchema = itemSchemas.length > 0 
      ? mergeSchemaDefinitions(itemSchemas)
      : { type: 'any' };
    
    return {
      type: 'array',
      items: mergedItemSchema,
      example: data.length > 10 ? `Array(${data.length})` : undefined
    };
  }

  if (typeof data === 'object') {
    const properties: Record<string, SchemaDefinition> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      properties[key] = analyzeJsonStructure(value);
      if (value !== undefined) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required
    };
  }

  const type = typeof data === 'number' && Number.isInteger(data) ? 'integer' : typeof data;
  return {
    type,
    example: ['string', 'number', 'boolean'].includes(type) ? data : undefined
  };
}

function mergeSchemaDefinitions(schemas: SchemaDefinition[]): SchemaDefinition {
  if (schemas.length === 0) return { type: 'any' };
  if (schemas.length === 1) return schemas[0];

  const types = new Set(schemas.flatMap(s => Array.isArray(s.type) ? s.type : [s.type]));
  
  if (types.size === 1) {
    const type = types.values().next().value;
    
    if (type === 'object') {
      const allProperties = new Set(schemas.flatMap(s => Object.keys(s.properties || {})));
      const properties: Record<string, SchemaDefinition> = {};
      const required: string[] = [];

      for (const prop of allProperties) {
        const propSchemas = schemas
          .filter(s => s.properties?.[prop])
          .map(s => s.properties![prop]);
        
        if (propSchemas.length > 0) {
          properties[prop] = mergeSchemaDefinitions(propSchemas);
          if (schemas.every(s => s.required?.includes(prop))) {
            required.push(prop);
          }
        }
      }

      return { type, properties, required };
    }

    if (type === 'array') {
      const itemSchemas = schemas.filter(s => s.items).map(s => s.items!);
      return {
        type,
        items: itemSchemas.length > 0 ? mergeSchemaDefinitions(itemSchemas) : { type: 'any' }
      };
    }
  }

  return { type: Array.from(types) };
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

  const schema = analyzeJsonStructure(data.schema || data.sample || data);
  
  if (type === 'zod') {
    return generateZodSchema(schema, indent, options);
  }
  return generateJoiSchema(schema, indent, options);
}

function generateZodSchema(schema: SchemaDefinition, indent = '', options: SchemaOptions = {}): string {
  if (!schema || !schema.type) {
    return 'z.unknown()';
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  
  if (types.length > 1) {
    return types.map(type => generateZodSchema({ ...schema, type }, indent, options)).join(' || ');
  }

  const type = types[0];
  const addExample = (base: string, example: any) => {
    if (!options.showExamples || example === undefined) return base;
    return `${base} // example: ${typeof example === 'string' ? `"${example}"` : example}`;
  };
  
  switch (type) {
    case 'array': {
      const items = schema.items ? generateZodSchema(schema.items, indent + '  ', options) : 'z.unknown()';
      let result = `z.array(${items})`;
      if (options.showExamples && schema.example) {
        result += ` // ${schema.example}`;
      }
      return result;
    }
    case 'null':
      return 'z.null()';
    case 'string':
      return addExample('z.string()', schema.example);
    case 'number':
      return addExample('z.number()', schema.example);
    case 'integer':
      return addExample('z.number().int()', schema.example);
    case 'boolean':
      return addExample('z.boolean()', schema.example);
    case 'object': {
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        return 'z.object({})';
      }
      const properties = Object.entries(schema.properties)
        .map(([key, value]) => {
          const propSchema = generateZodSchema(value, indent + '  ', options);
          const isRequired = schema.required?.includes(key);
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
  if (!schema || !schema.type) {
    return 'Joi.any()';
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  
  if (types.length > 1) {
    return types.map(type => generateJoiSchema({ ...schema, type }, indent, options)).join('.or(');
  }

  const type = types[0];
  const addExample = (base: string, example: any) => {
    if (!options.showExamples || example === undefined) return base;
    return `${base} // example: ${typeof example === 'string' ? `"${example}"` : example}`;
  };
  
  switch (type) {
    case 'array': {
      const items = schema.items ? generateJoiSchema(schema.items, indent + '  ', options) : 'Joi.any()';
      let result = `Joi.array().items(${items})`;
      if (options.showExamples && schema.example) {
        result += ` // ${schema.example}`;
      }
      return result;
    }
    case 'null':
      return 'Joi.valid(null)';
    case 'string':
      return addExample('Joi.string()', schema.example);
    case 'number':
      return addExample('Joi.number()', schema.example);
    case 'integer':
      return addExample('Joi.number().integer()', schema.example);
    case 'boolean':
      return addExample('Joi.boolean()', schema.example);
    case 'object': {
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        return 'Joi.object()';
      }
      const properties = Object.entries(schema.properties)
        .map(([key, value]) => {
          const propSchema = generateJoiSchema(value, indent + '  ', options);
          const isRequired = schema.required?.includes(key);
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