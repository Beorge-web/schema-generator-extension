export type SchemaType = 'joi' | 'zod';
export type ViewMode = 'monitor' | 'custom';

export interface Request {
  id: string;
  method: string;
  url: string;
  type?: string;
  timestamp: number;
  responseBody?: {
    data?: any;
    error?: string;
    details?: string;
  };
}
