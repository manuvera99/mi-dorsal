// Stub de _generated/dataModel.ts — generado por `npx convex dev`.
// Define los tipos Doc<...> e Id<...> basados en schema.ts.

import type { GenericId } from "convex/values";

export type Id<TableName extends string> = GenericId<TableName>;

export type Doc<TableName extends string> = Record<string, any>;

export type DataModel = Record<string, any>;
