import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const wanCloudEditSchema = z.object({
  name: z.string().min(1, 'Cloud name is required'),
  type: z.string().min(1, 'Cloud type is required'),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  color: z.string().min(1, 'Color is required'),
});

type WANCloudEditForm = z.infer<typeof wanCloudEditSchema>;

interface WANCloud {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  color: string;
}

interface WANCloudEditDialogProps {
  cloud: WANCloud | null;
  open: boolean;
  onClose: () => void;
  onSave: (cloudId: string, updates: Partial<WANCloud>) => void;
  onDelete?: (cloudId: string) => void;
  onHide?: (cloudId: string) => void;
}

export default function WANCloudEditDialog({ 
  cloud, 
  open, 
  onClose, 
  onSave, 
  onDelete,
  onHide
}: WANCloudEditDialogProps) {
  const form = useForm<WANCloudEditForm>({
    resolver: zodResolver(wanCloudEditSchema),
    defaultValues: {
      name: cloud?.name || '',
      type: cloud?.type || '',
      x: cloud?.x || 0.5,
      y: cloud?.y || 0.5,
      color: cloud?.color || '#3b82f6',
    },
  });

  React.useEffect(() => {
    if (cloud) {
      form.reset({
        name: cloud.name,
        type: cloud.type,
        x: cloud.x,
        y: cloud.y,
        color: cloud.color,
      });
    }
  }, [cloud, form]);

  const onSubmit = (data: WANCloudEditForm) => {
    if (!cloud) return;
    
    onSave(cloud.id, {
      name: data.name,
      type: data.type,
      x: data.x,
      y: data.y,
      color: data.color,
    });
    
    onClose();
  };

  const handleDelete = () => {
    if (!cloud || !onDelete) return;
    
    if (confirm(`Are you sure you want to remove the "${cloud.name}" WAN cloud? This will hide it from the topology view.`)) {
      onDelete(cloud.id);
      onClose();
    }
  };

  const handleHide = () => {
    if (!cloud || !onHide) return;
    
    onHide(cloud.id);
    onClose();
  };

  if (!cloud) return null;

  const cloudTypes = [
    { value: 'Internet', label: 'Internet WAN' },
    { value: 'MPLS', label: 'MPLS WAN' },
    { value: 'AWS', label: 'AWS Direct Connect' },
    { value: 'Azure', label: 'Azure ExpressRoute' },
    { value: 'NaaS', label: 'NaaS/SD-WAN' },
    { value: 'VPLS', label: 'VPLS Network' },
    { value: 'Private', label: 'Private Network' },
  ];

  const predefinedColors = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ff9900', label: 'Orange' },
    { value: '#0078d4', label: 'Azure Blue' },
    { value: '#f97316', label: 'Megaport Orange' },
    { value: '#10b981', label: 'Green' },
    { value: '#ef4444', label: 'Red' },
    { value: '#6b7280', label: 'Gray' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-wan-cloud-edit">
        <DialogHeader>
          <DialogTitle>Edit WAN Cloud: {cloud.name}</DialogTitle>
          <DialogDescription>
            Configure WAN cloud properties, position, and appearance
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cloud Name</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Enter cloud name"
                      data-testid="input-cloud-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cloud Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-cloud-type">
                        <SelectValue placeholder="Select cloud type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cloudTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="x"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>X Position (0-1)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-cloud-x"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="y"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Y Position (0-1)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-cloud-y"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-cloud-color">
                        <SelectValue placeholder="Select color" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {predefinedColors.map(color => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-full border border-gray-300" 
                              style={{ backgroundColor: color.value }}
                            />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Position Preview */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Position Preview</h4>
              <div className="relative bg-white border border-gray-200 rounded h-32 overflow-hidden">
                <div 
                  className="absolute w-3 h-3 rounded-full border-2"
                  style={{ 
                    backgroundColor: form.watch('color'),
                    borderColor: form.watch('color'),
                    left: `${form.watch('x') * 100}%`,
                    top: `${form.watch('y') * 100}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Position: ({Math.round(form.watch('x') * 100)}%, {Math.round(form.watch('y') * 100)}%)
              </p>
            </div>

            <DialogFooter className="flex justify-between">
              <div className="flex gap-2">
                {onHide && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleHide}
                    data-testid="button-hide-cloud"
                  >
                    Hide Cloud
                  </Button>
                )}
                {onDelete && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={handleDelete}
                    data-testid="button-delete-cloud"
                  >
                    Remove Cloud
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
                  data-testid="button-save-cloud"
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