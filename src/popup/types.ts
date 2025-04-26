export type SchemaType = "zod" | "joi";

export interface Request {
  id: string;
  method: string;
  url: string;
  responseBody: any;
}
