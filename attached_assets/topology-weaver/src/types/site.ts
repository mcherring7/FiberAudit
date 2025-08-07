export interface Coordinates {
  x: number;
  y: number;
}

export interface Connection {
  type: string;
  bandwidth: string;
  provider?: string;
  // For point-to-point circuits
  remoteEndpoint?: {
    siteId: string;
    siteName: string;
  };
  circuitId?: string;
}

export type SiteCategory = "Corporate" | "Data Center" | "Branch";

export interface Site {
  id: string;
  name: string;
  location: string;
  category: SiteCategory;
  connections: Connection[];
  coordinates: Coordinates;
}