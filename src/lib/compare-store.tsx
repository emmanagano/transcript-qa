'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CompareResult, Mode } from './compare/engine';

/**
 * The latest comparison lives only in memory. Refreshing or closing the tab clears it,
 * so transcript text never ends up in storage or on a server.
 */
export interface OpenComparison {
  mode: Mode;
  caseName: string;
  aiTool: string | null;
  result: CompareResult;
  savedAt: string | null;
  saveError: string | null;
}

interface Store {
  current: OpenComparison | null;
  setCurrent: (c: OpenComparison | null) => void;
  lastMode: Mode;
  setLastMode: (m: Mode) => void;
}

const CompareContext = createContext<Store | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<OpenComparison | null>(null);
  const [lastMode, setLastMode] = useState<Mode>('accuracy');
  return (
    <CompareContext.Provider value={{ current, setCurrent, lastMode, setLastMode }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used inside CompareProvider');
  return ctx;
}
