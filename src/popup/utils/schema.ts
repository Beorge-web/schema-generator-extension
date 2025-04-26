import { SchemaType } from '../types';

export function generateSchemaFromJson(data: any, type: SchemaType = 'zod', indent = ''): string {
  if (type === 'zod') {
    return generateZodSchema(data, indent);
  }
  return generateJoiSchema(data, indent);
}

function generateZodSchema(data: any, indent = ''): string {
  if (Array.isArray(data)) {
    const sample = data[0];
    if (sample === undefined) {
      return 'z.array(z.unknown())';
    }
    return `z.array(${generateZodSchema(sample, indent + '  ')})`;
  }
  
  if (data === null) {
    return 'z.null()';
  }
  
  switch (typeof data) {
    case 'string':
      return 'z.string()';
    case 'number':
      return Number.isInteger(data) ? 'z.number().int()' : 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    case 'object': {
      const properties = Object.entries(data)
        .map(([key, value]) => `${indent}  ${key}: ${generateZodSchema(value, indent + '  ')}`)
        .join(',\n');
      return `z.object({\n${properties}\n${indent}})`;
    }
    default:
      return 'z.unknown()';
  }
}

function generateJoiSchema(data: any, indent = ''): string {
  if (Array.isArray(data)) {
    const sample = data[0];
    if (sample === undefined) {
      return 'Joi.array()';
    }
    return `Joi.array().items(${generateJoiSchema(sample, indent + '  ')})`;
  }
  
  if (data === null) {
    return 'Joi.valid(null)';
  }
  
  switch (typeof data) {
    case 'string':
      return 'Joi.string()';
    case 'number':
      return Number.isInteger(data) ? 'Joi.number().integer()' : 'Joi.number()';
    case 'boolean':
      return 'Joi.boolean()';
    case 'object': {
      const properties = Object.entries(data)
        .map(([key, value]) => `${indent}  ${key}: ${generateJoiSchema(value, indent + '  ')}`)
        .join(',\n');
      return `Joi.object({\n${properties}\n${indent}})`;
    }
    default:
      return 'Joi.any()';
  }
} 