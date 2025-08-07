import { Site } from './site';

export interface NetworkElement {
  id: string;
  type: 'internet' | 'mpls' | 'vpls' | 'point-to-point' | 'aws' | 'azure' | 'gcp' | 'oracle' | 'custom';
  name: string;
  enabled: boolean;
  customProvider?: string;
}

export interface TopologyConfig {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  lastModified: Date;
  networkElements: NetworkElement[];
  sites?: Site[];
}

export interface NetworkAssessment {
  hasPublicConnectivity: boolean;
  publicConnectivityTypes: string[];
  hasPrivateConnectivity: boolean;
  privateConnectivityTypes: string[];
  hasHyperscalers: boolean;
  hyperscalerTypes: string[];
  selectedProviders: string[];
  additionalElements: string[];
}