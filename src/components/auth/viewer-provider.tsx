"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ViewerSession } from "@/domain/viewer";

type ViewerContextValue = {
  viewer: ViewerSession | null;
};

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({
  initialViewer,
  children,
}: {
  initialViewer: ViewerSession | null;
  children: ReactNode;
}) {
  const value = useMemo<ViewerContextValue>(
    () => ({
      viewer: initialViewer,
    }),
    [initialViewer],
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  const context = useContext(ViewerContext);

  return context?.viewer ?? null;
}
