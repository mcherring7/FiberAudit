
import { SiteCategory } from "@/types/site";

export const connectionTypes = [
  "DIA", 
  "MPLS", 
  "VPLS",
  "Point-to-Point", 
  "Direct Connect", 
  "Broadband", 
  "LTE",
  "AWS Direct Connect",
  "Azure ExpressRoute",
  "Google Cloud Interconnect",
  "Oracle FastConnect"
];

export const hyperscalerConnectionTypes = [
  "AWS Direct Connect",
  "Azure ExpressRoute", 
  "Google Cloud Interconnect",
  "Oracle FastConnect"
];

export const bandwidthOptions = ["10 Mbps", "50 Mbps", "100 Mbps", "500 Mbps", "1 Gbps", "10 Gbps"];

export const defaultProviderOptions = [
  "AT&T", 
  "Verizon", 
  "Lumen", 
  "Comcast", 
  "Spectrum", 
  "Zayo",
  "Cogent",
  "NTT Communications",
  "Orange Business",
  "BT Global"
];

export const siteCategories: SiteCategory[] = ["Corporate", "Data Center", "Branch"];

// Function to get available providers based on assessment results
export const getAvailableProviders = (selectedProviders: string[] = [], additionalProviders: string[] = []): string[] => {
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

  const assessmentProviders = selectedProviders.map(id => providerMap[id] || id);
  const allProviders = [...new Set([...assessmentProviders, ...additionalProviders, ...defaultProviderOptions])];
  
  return allProviders.filter(Boolean).sort();
};
