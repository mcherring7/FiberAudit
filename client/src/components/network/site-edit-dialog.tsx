import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const siteEditSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  location: z.string().min(1, 'Location is required'),
  category: z.enum(['Branch', 'Corporate', 'Data Center', 'Cloud']),
  description: z.string().optional(),
});

type SiteEditForm = z.infer<typeof siteEditSchema>;

interface Connection {
  type: string;
  bandwidth: string;
  provider?: string;
  pointToPointEndpoint?: string;
  customProvider?: string;
}

interface Site {
  id: string;
  name: string;
  location: string;
  category: "Branch" | "Corporate" | "Data Center" | "Cloud";
  connections: Connection[];
  coordinates: { x: number; y: number };
  description?: string;
}

interface SiteEditDialogProps {
  site: Site | null;
  open: boolean;
  onClose: () => void;
  onSave: (siteId: string, updates: Partial<Site>) => void;
  onDelete?: (siteId: string) => void;
}

export default function SiteEditDialog({ 
  site, 
  open, 
  onClose, 
  onSave, 
  onDelete 
}: SiteEditDialogProps) {
  const form = useForm<SiteEditForm>({
    resolver: zodResolver(siteEditSchema),
    defaultValues: {
      name: site?.name || '',
      location: site?.location || '',
      category: site?.category || 'Branch',
      description: site?.description || '',
    },
  });

  React.useEffect(() => {
    if (site) {
      form.reset({
        name: site.name,
        location: site.location,
        category: site.category,
        description: site.description || '',
      });
    }
  }, [site, form]);

  const onSubmit = (data: SiteEditForm) => {
    if (!site) return;
    
    onSave(site.id, {
      name: data.name,
      location: data.location,
      category: data.category,
      description: data.description,
    });
    
    onClose();
  };

  const handleDelete = () => {
    if (!site || !onDelete) return;
    
    if (confirm(`Are you sure you want to delete site "${site.name}"? This action cannot be undone.`)) {
      onDelete(site.id);
      onClose();
    }
  };

  if (!site) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-site-edit">
        <DialogHeader>
          <DialogTitle>Edit Site: {site.name}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site Name</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Enter site name"
                      data-testid="input-site-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="City, State or Address"
                      data-testid="input-site-location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-site-category">
                        <SelectValue placeholder="Select site type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Branch">Branch Office</SelectItem>
                      <SelectItem value="Corporate">Corporate HQ</SelectItem>
                      <SelectItem value="Data Center">Data Center</SelectItem>
                      <SelectItem value="Cloud">Cloud Region</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Additional notes about this site..."
                      rows={3}
                      data-testid="textarea-site-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Site Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Site Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Connections:</span>
                  <span className="ml-2 font-medium">{site.connections.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Position:</span>
                  <span className="ml-2 font-medium">
                    ({Math.round(site.coordinates.x * 100)}%, {Math.round(site.coordinates.y * 100)}%)
                  </span>
                </div>
              </div>
              {site.connections.length > 0 && (
                <div className="mt-2">
                  <span className="text-gray-600">Connection Types:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Array.from(new Set(site.connections.map(c => c.type))).map(type => (
                      <span 
                        key={type}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between">
              <div>
                {onDelete && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={handleDelete}
                    data-testid="button-delete-site"
                  >
                    Delete Site
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  data-testid="button-save-site"
                >
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}