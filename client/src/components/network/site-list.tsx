import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

// Navigation handled via window.location

interface Site {
  id: string;
  name: string;
  location: string;
  category: "Branch" | "Corporate" | "Data Center" | "Cloud";
  connections: Connection[];
  coordinates: { x: number; y: number };
}

interface Connection {
  type: string;
  bandwidth: string;
  provider?: string;
  pointToPointEndpoint?: string;
  customProvider?: string;
}

interface SiteListProps {
  sites: Site[];
  selectedSite: Site | null;
  onSelectSite: (site: Site | null) => void;
}

const SiteList = ({ sites, selectedSite, onSelectSite }: SiteListProps) => {
  // Get site icon based on category
  const getSiteIcon = (category: string) => {
    switch (category) {
      case 'Corporate': return '🏢';
      case 'Data Center': return '🏭';
      case 'Cloud': return '☁️';
      default: return '🏪';
    }
  };

  // Get connection type badge color
  const getConnectionBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type.toLowerCase()) {
      case 'internet':
      case 'broadband':
      case 'dedicated':
        return 'default';
      case 'mpls':
      case 'vpls':
      case 'private':
        return 'secondary';
      case 'aws':
      case 'azure':
      case 'gcp':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // Sort sites by category and name
  const sortedSites = [...sites].sort((a, b) => {
    if (a.category !== b.category) {
      const categoryOrder = ['Corporate', 'Data Center', 'Branch', 'Cloud'];
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {sortedSites.map((site) => {
          const isSelected = selectedSite?.id === site.id;

          return (
            <Card
              key={site.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                isSelected
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => onSelectSite(isSelected ? null : site)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getSiteIcon(site.category)}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm text-gray-900 truncate">
                        {site.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {site.location}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {site.category}
                  </Badge>
                </div>

                {/* Connections */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">
                      Connections ({site.connections.length})
                    </span>
                  </div>

                  {site.connections.length > 0 && (
                    <div className="space-y-1">
                      {site.connections.slice(0, 3).map((connection, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={getConnectionBadgeVariant(connection.type)}
                              className="text-xs px-1.5 py-0.5"
                            >
                              {connection.type.toUpperCase()}
                            </Badge>
                            <span className="text-gray-600">
                              {connection.bandwidth}
                            </span>
                          </div>
                          {connection.provider && (
                            <span className="text-gray-500 text-xs truncate max-w-20">
                              {connection.provider}
                            </span>
                          )}
                        </div>
                      ))}

                      {site.connections.length > 3 && (
                        <div className="text-xs text-gray-500 text-center pt-1">
                          +{site.connections.length - 3} more
                        </div>
                      )}
                    </div>
                  )}

                  {site.connections.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-1">
                      No connections
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sites.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <span className="text-3xl mb-2 block">📍</span>
          <p className="text-sm">No sites to display</p>
        </div>
      )}
    </ScrollArea>
  );
};

export default SiteList;