// Stub de _generated/server.ts — generado normalmente por `npx convex dev`.
// En este stub usamos `any` para los tipos complejos del builder de Convex,
// lo que permite que el código compile sin tener una cuenta de Convex.
// En producción, `npx convex dev` regenera este archivo con tipos precisos.

import {
  anyApi,
  componentsGeneric,
  cronJobs,
  queryGeneric,
  mutationGeneric,
  actionGeneric,
  internalQueryGeneric,
  internalMutationGeneric,
  internalActionGeneric,
  httpActionGeneric,
  httpRouter,
} from "convex/server";

// Tipos permisivos para que el código compile
export type QueryCtx = any;
export type MutationCtx = any;
export type ActionCtx = any;
export type GenericQueryCtx = any;
export type GenericMutationCtx = any;
export type GenericActionCtx = any;

// Builders exportados (pasan el tipo `any` para que no fallen las firmas)
export const query: any = queryGeneric;
export const mutation: any = mutationGeneric;
export const action: any = actionGeneric;
export const internalQuery: any = internalQueryGeneric;
export const internalMutation: any = internalMutationGeneric;
export const internalAction: any = internalActionGeneric;
export const httpAction: any = httpActionGeneric;
export { httpRouter };

export { componentsGeneric as components, anyApi, cronJobs };
