"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { mockApi } from "@/lib/mock/provider";
import { isMockMode } from "@/lib/mock/provider";

/**
 * Hook que devuelve la query de Convex o la implementación mock según el modo.
 * En mock mode, evita los hooks de Convex para no lanzar errores.
 */
export function useApiQuery<T extends (...args: any[]) => any>(
  convexQuery: T | undefined,
  args: Parameters<T>[0] = {} as any,
  mockImpl: () => ReturnType<T>,
): ReturnType<T> | undefined {
  const useMock = isMockMode();
  const [mockData, setMockData] = useState<ReturnType<T> | undefined>(undefined);

  useEffect(() => {
    if (useMock) {
      setMockData(mockImpl());
    }
  }, [useMock, JSON.stringify(args)]);

  if (useMock) {
    return mockData;
  }
  // Use Convex query (will throw if convexQuery is undefined)
  return (useQuery as any)(convexQuery, args);
}
