
export const getCategoryColor = (category: string) => {
  switch (category) {
    case "Corporate":
      return "#8B5CF6"; // Purple
    case "Data Center":
      return "#10B981"; // Green
    case "Branch":
      return "#3B82F6"; // Blue
    default:
      return "#6B7280"; // Gray
  }
};

export const getConnectionColor = (connectionType: string) => {
  switch (connectionType) {
    case "DIA":
      return "#10b981"; // Green
    case "MPLS":
      return "#3b82f6"; // Blue
    case "Direct Connect":
      return "#8b5cf6"; // Purple
    case "Broadband":
      return "#f59e0b"; // Yellow
    case "LTE":
      return "#ef4444"; // Red
    default:
      return "#6b7280"; // Gray
  }
};

export const getProviderColor = (provider?: string) => {
  if (!provider) return "#6b7280"; // Gray default
  
  switch (provider) {
    case "AT&T":
      return "#0057b8"; // AT&T Blue
    case "Verizon":
      return "#cd040b"; // Verizon Red
    case "Lumen":
      return "#00c0f3"; // Lumen Blue
    case "Comcast":
      return "#ff0000"; // Comcast Red
    case "Spectrum":
      return "#0072ce"; // Spectrum Blue
    case "Zayo":
      return "#ffda00"; // Zayo Yellow
    default:
      return "#6b7280"; // Gray
  }
};
