export type SchemaType = 'joi' | 'zod';
export type ViewMode = 'monitor' | 'custom';

export interface Request {
  id: string;
  method: string;
  url: string;
  type?: string;
  timestamp: number;
  responseBody?: {
    schema?: any;
    sample?: any;
    error?: string;
    details?: string;
  };
}
