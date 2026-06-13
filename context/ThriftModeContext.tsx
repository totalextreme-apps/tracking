import React, { createContext, useContext } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';

type ThriftModeContextType = {
  thriftMode: boolean;
  setThriftMode: (value: boolean) => void;
};

const ThriftModeContext = createContext<ThriftModeContextType | null>(null);

export function ThriftModeProvider({ children }: { children: React.ReactNode }) {
  const [thriftMode, setThriftMode] = usePersistedState('thrift_mode', false);
  return (
    <ThriftModeContext.Provider value={{ thriftMode, setThriftMode }}>
      {children}
    </ThriftModeContext.Provider>
  );
}

export function useThriftMode() {
  const ctx = useContext(ThriftModeContext);
  if (!ctx) throw new Error('useThriftMode must be used within ThriftModeProvider');
  return ctx;
}
