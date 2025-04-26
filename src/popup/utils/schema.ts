import { SchemaType } from '../types';

interface SchemaOptions {
  showExamples?: boolean;
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

  if (!data.schema) {
    return type === 'zod'
      ? '// Error: No schema data available\nz.unknown()'
      : '// Error: No schema data available\nJoi.any()';
  }
  
  if (type === 'zod') {
    return generateZodSchema(data.schema, indent, options);
  }
  return generateJoiSchema(data.schema, indent, options);
}

function generateZodSchema(schema: any, indent = '', options: SchemaOptions = {}): string {
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
    default:
      return 'z.unknown()';
  }
}

function generateJoiSchema(schema: any, indent = '', options: SchemaOptions = {}): string {
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
    default:
      return 'Joi.any()';
  }
} 