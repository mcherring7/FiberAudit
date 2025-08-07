import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ProviderContextType {
  selectedProviders: string[];
  additionalProviders: string[];
  setSelectedProviders: (providers: string[]) => void;
  setAdditionalProviders: (providers: string[]) => void;
  getAvailableProviders: () => string[];
}

const ProviderContext = createContext<ProviderContextType | undefined>(undefined);

export const useProviders = () => {
  const context = useContext(ProviderContext);
  if (context === undefined) {
    throw new Error('useProviders must be used within a ProviderProvider');
  }
  return context;
};

interface ProviderProviderProps {
  children: ReactNode;
}

export const ProviderProvider: React.FC<ProviderProviderProps> = ({ children }) => {
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [additionalProviders, setAdditionalProviders] = useState<string[]>([]);

  const providerMap: Record<string, string> = {
    "att": "AT&T",
    "verizon": "Verizon", 
    "lumen": "Lumen",
    "comcast": "Comcast",
    "spectrum": "Spectrum",
    "zayo": "Zayo",
    "cogent": "Cogent",
    "ntt": "NTT Communications",
    "orange": "Orange Business",
    "bt": "BT Global"
  };

  const defaultProviders = [
    "AT&T", "Verizon", "Lumen", "Comcast", "Spectrum", "Zayo"
  ];

  const getAvailableProviders = (): string[] => {
    const assessmentProviders = selectedProviders.map(id => providerMap[id] || id);
    const allProviders = [...new Set([...assessmentProviders, ...additionalProviders, ...defaultProviders])];
    return allProviders.filter(Boolean).sort();
  };

  return (
    <ProviderContext.Provider
      value={{
        selectedProviders,
        additionalProviders,
        setSelectedProviders,
        setAdditionalProviders,
        getAvailableProviders,
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
};