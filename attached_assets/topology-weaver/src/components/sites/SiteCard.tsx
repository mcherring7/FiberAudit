
import { Site } from "@/types/site";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface SiteCardProps {
  site: Site;
  isSelected: boolean;
  onSelect: (site: Site) => void;
  onEdit: (site: Site) => void;
  onDelete: (id: string, name: string) => void;
  getCategoryColor: (category: string) => string;
  getConnectionColor: (connectionType: string) => string;
  getProviderColor: (provider?: string) => string;
}

const SiteCard = ({
  site,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  getCategoryColor,
  getConnectionColor,
  getProviderColor,
}: SiteCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className={`cursor-pointer transition-all ${
          isSelected ? "border-gray-400 shadow-md" : "border-gray-200"
        }`}
        onClick={() => onSelect(site)}
      >
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>{site.name}</span>
            <span 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: getCategoryColor(site.category) }}
            />
          </CardTitle>
          <CardDescription className="text-xs">
            <span className="inline-block mr-1">{site.category}</span>
            <span>- {site.location}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="py-0 px-4 text-xs text-gray-600">
          <div className="flex flex-col gap-1">
            {site.connections.map((conn, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="flex items-center">
                  <span 
                    className="w-2 h-2 rounded-full mr-1" 
                    style={{ backgroundColor: conn.provider 
                      ? getProviderColor(conn.provider) 
                      : getConnectionColor(conn.type) 
                    }}
                  />
                  {conn.type}
                </span>
                <div className="text-right">
                  <span>{conn.bandwidth}</span>
                  {conn.provider && (
                    <span className="block text-gray-400 text-xs">
                      {conn.provider}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="py-2 px-4 flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(site);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(site.id, site.name);
            }}
          >
            Delete
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default SiteCard;
