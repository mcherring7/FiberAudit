
import { SiteCategory } from "@/types/site";
import { Button } from "@/components/ui/button";
import { Filter, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface CategoryFilterProps {
  categoryFilters: SiteCategory[];
  onCategoryFiltersChange: (categories: SiteCategory[]) => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (isOpen: boolean) => void;
  getCategoryColor: (category: string) => string;
  siteCategories: SiteCategory[];
}

const CategoryFilter = ({
  categoryFilters,
  onCategoryFiltersChange,
  isFilterOpen,
  setIsFilterOpen,
  getCategoryColor,
  siteCategories,
}: CategoryFilterProps) => {
  const handleCategoryFilterChange = (category: SiteCategory) => {
    onCategoryFiltersChange(
      categoryFilters.includes(category)
        ? categoryFilters.filter(c => c !== category)
        : [...categoryFilters, category]
    );
  };

  const resetFilters = () => {
    onCategoryFiltersChange(siteCategories);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={`h-8 w-8 p-0 ${categoryFilters.length < siteCategories.length ? 'bg-gray-100' : ''}`}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-sm">Filter by Category</h4>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs" 
                onClick={resetFilters}
              >
                Reset
              </Button>
            </div>
            <div className="space-y-2">
              {siteCategories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`category-${category}`} 
                    checked={categoryFilters.includes(category)}
                    onCheckedChange={() => handleCategoryFilterChange(category)}
                  />
                  <label 
                    htmlFor={`category-${category}`}
                    className="flex-1 text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: getCategoryColor(category) }}
                    />
                    {category}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {categoryFilters.length < siteCategories.length && (
        <div className="text-xs text-gray-500">
          Filtered: {categoryFilters.length}/{siteCategories.length}
        </div>
      )}
    </div>
  );
};

export default CategoryFilter;
