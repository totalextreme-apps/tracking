import React, { createContext, useContext, useState } from 'react';

type ThriftModeContextType = {
  thriftMode: boolean;
  setThriftMode: (value: boolean) => void;
};

const ThriftModeContext = createContext<ThriftModeContextType | null>(null);

export function ThriftModeProvider({ children }: { children: React.ReactNode }) {
  const [thriftMode, setThriftMode] = useState(false);
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
