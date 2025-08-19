import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Building, Plus, Search, CheckCircle, AlertCircle, Edit } from 'lucide-react';
import { Site, InsertSite } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import SiteEditDialog from '@/components/network/site-edit-dialog';

export default function SitesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current project ID from localStorage first (app stores it),
  // and fall back to URL parsing if present
  const currentProjectId = (() => {
    const fromStorage = localStorage.getItem('currentProjectId');
    if (fromStorage) return fromStorage;
    const pathParts = window.location.pathname.split('/');
    const projectIndex = pathParts.indexOf('projects');
    if (projectIndex !== -1 && projectIndex < pathParts.length - 1) {
      return pathParts[projectIndex + 1];
    }
    return '';
  })();

  const { data: sites = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/sites', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const response = await fetch(`/api/sites?projectId=${currentProjectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sites');
      }
      return response.json();
    },
    enabled: !!currentProjectId,
  });

  const createSiteMutation = useMutation({
    mutationFn: async (siteData: InsertSite) => {
      const response = await fetch(`/api/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...siteData,
          projectId: currentProjectId
        }),
      });
      if (!response.ok) {
        let message = 'Failed to create site';
        try {
          const data = await response.json();
          if (data?.message) message = data.message;
        } catch (_e) {
          // ignore JSON parse error
        }
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites', currentProjectId] });
      toast({ title: 'Success', description: 'Site created successfully' });
      setEditingSite(null);
    },
    onError: (error) => {
      console.error('Create site error:', error);
      toast({ 
        title: 'Error', 
        description: (error as Error)?.message || 'Failed to create site',
        variant: 'destructive' 
      });
    },
  });

  const updateSiteMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Site> }) => {
      const response = await fetch(`/api/sites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update site');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites', currentProjectId] });
      toast({ title: 'Success', description: 'Site updated successfully' });
      setEditingSite(null);
    },
    onError: (error) => {
      console.error('Update site error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to update site',
        variant: 'destructive' 
      });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/sites/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete site');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites', currentProjectId] });
      toast({ title: 'Success', description: 'Site deleted successfully' });
    },
    onError: (error) => {
      console.error('Delete site error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to delete site',
        variant: 'destructive' 
      });
    },
  });

  const filteredSites = sites.filter((site: Site) => {
    const matchesSearch = site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.state?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || site.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSaveSite = (siteId: string | null, updates: Partial<Site>) => {
    if (!currentProjectId) {
      toast({
        title: 'Project required',
        description: 'Open this page via a project (e.g., /projects/{projectId}/sites) to add sites.',
        variant: 'destructive',
      });
      return;
    }
    if (siteId) {
      updateSiteMutation.mutate({ id: siteId, updates });
    } else {
      // Creating new site
      createSiteMutation.mutate(updates as InsertSite);
    }
  };

  const handleDeleteSite = (siteId: string) => {
    deleteSiteMutation.mutate(siteId);
  };

  const getAddressValidationBadge = (site: Site) => {
    if (site.addressValidated) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Validated
        </Badge>
      );
    } else if (site.streetAddress) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          <AlertCircle className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
        No Address
      </Badge>
    );
  };

  const getProximityInfo = (site: Site) => {
    if (site.nearestMegaportPop && site.megaportDistance) {
      return (
        <div className="text-sm text-gray-600">
          <div>Nearest Megaport: {site.nearestMegaportPop}</div>
          <div>Distance: {site.megaportDistance.toFixed(1)} miles</div>
        </div>
      );
    }
    return <span className="text-sm text-gray-400">Proximity analysis pending</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Site Management</h1>
          <p className="text-gray-600 mt-1">
            Manage site locations and validate addresses for proximity analysis
          </p>
        </div>
        <Button 
          onClick={() => currentProjectId && setEditingSite({} as Site)} // Empty object to indicate new site
          disabled={!currentProjectId}
          data-testid="button-add-site"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Site
        </Button>
      </div>

      {/* Project context banner */}
      {!currentProjectId && (
        <div className="mt-4 p-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900">
          <div className="font-semibold">Project context required</div>
          <div className="text-sm mt-1">
            Open this page from a specific project so the URL looks like <code>/projects/&lt;projectId&gt;/sites</code>. 
            This ensures sites are created under the correct project and prevents demo fallback.
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Building className="h-4 w-4 mr-2" />
              Total Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sites.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              Address Validated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {sites.filter((site: Site) => site.addressValidated).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-blue-600" />
              Megaport Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {sites.filter((site: Site) => site.nearestMegaportPop).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 text-amber-600" />
              Pending Validation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {sites.filter((site: Site) => site.streetAddress && !site.addressValidated).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search sites by name, location, city, or state..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-sites"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Branch">Branch Office</SelectItem>
                <SelectItem value="Corporate">Corporate HQ</SelectItem>
                <SelectItem value="Data Center">Data Center</SelectItem>
                <SelectItem value="Cloud">Cloud Location</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sites Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sites ({filteredSites.length})</CardTitle>
          <CardDescription>
            Site locations with address validation and proximity analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Validation Status</TableHead>
                <TableHead>Megaport Proximity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading sites...
                  </TableCell>
                </TableRow>
              ) : filteredSites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {searchTerm || categoryFilter !== 'all' 
                      ? 'No sites found matching your filters.' 
                      : 'No sites created yet. Add your first site to get started.'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredSites.map((site: Site) => (
                  <TableRow key={site.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{site.name}</div>
                        <div className="text-sm text-gray-500">{site.location}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{site.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {site.streetAddress ? (
                        <div className="text-sm">
                          <div>{site.streetAddress}</div>
                          <div>{site.city}, {site.state} {site.postalCode}</div>
                          <div className="text-gray-500">{site.country}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">No address provided</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getAddressValidationBadge(site)}
                    </TableCell>
                    <TableCell>
                      {getProximityInfo(site)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSite(site)}
                        data-testid={`button-edit-site-${site.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Site Edit Dialog */}
      <SiteEditDialog
        site={editingSite}
        open={!!editingSite}
        onClose={() => setEditingSite(null)}
        onSave={handleSaveSite}
        onDelete={handleDeleteSite}
      />
    </div>
    </div>
  );
}