
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AddSiteDialog from "@/components/sites/AddSiteDialog";
import EditSiteDialog from "@/components/sites/EditSiteDialog";
import CategoryFilter from "@/components/sites/CategoryFilter";
import SiteCard from "@/components/sites/SiteCard";
import { Site, SiteCategory } from "@/types/site";
import { NetworkElement } from "@/types/topology";
import { Plus, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SiteListProps {
  sites: Site[];
  onSiteChange: (sites: Site[]) => void;
  selectedSite: Site | null;
  onSiteClick: (site: Site) => void;
  networkElements: NetworkElement[];
}

const SiteList = ({ 
  sites = [], 
  onSiteChange, 
  selectedSite, 
  onSiteClick,
  networkElements = []
}: SiteListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<SiteCategory[]>(["Corporate", "Data Center", "Branch"]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);

  const getRandomCoordinates = () => {
    return {
      x: 0.2 + Math.random() * 0.6,
      y: 0.3 + Math.random() * 0.5
    };
  };

  const addSite = (site: Site) => {
    const newSite = { 
      ...site, 
      id: String(sites.length + 1), 
      coordinates: getRandomCoordinates() 
    };
    onSiteChange([...sites, newSite]);
  };

  const updateSite = (updatedSite: Site) => {
    onSiteChange(sites.map(site => site.id === updatedSite.id ? updatedSite : site));
  };

  const removeSite = (id: string) => {
    onSiteChange(sites.filter(site => site.id !== id));
  };

  const filteredSites = sites.filter(site => {
    const matchesSearch = site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         site.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilters.includes(site.category);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Sites</h2>
          <Button 
            size="sm" 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Site
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search sites..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <CategoryFilter 
          filters={categoryFilters} 
          onChange={setCategoryFilters} 
        />

        <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
          <span>Total: {sites.length}</span>
          <span>•</span>
          <span>Filtered: {filteredSites.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {filteredSites.map((site, index) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <SiteCard
                site={site}
                isSelected={selectedSite?.id === site.id}
                onClick={() => onSiteClick(site)}
                onEdit={() => setEditingSite(site)}
                onRemove={() => removeSite(site.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredSites.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="text-gray-400 mb-2">No sites found</div>
            <div className="text-sm text-gray-500">
              {searchTerm ? "Try adjusting your search" : "Add your first site to get started"}
            </div>
          </motion.div>
        )}
      </div>

      <AddSiteDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAddSite={addSite}
        networkElements={networkElements}
      />

      {editingSite && (
        <EditSiteDialog
          site={editingSite}
          isOpen={!!editingSite}
          onClose={() => setEditingSite(null)}
          onUpdateSite={updateSite}
          networkElements={networkElements}
        />
      )}
    </div>
  );
};

export { SiteList };
export default SiteList;
