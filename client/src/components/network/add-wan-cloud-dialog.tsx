import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const addWANCloudSchema = z.object({
  name: z.string().min(1, 'Cloud name is required'),
  type: z.string().min(1, 'Cloud type is required'),
  color: z.string().min(1, 'Color is required'),
});

type AddWANCloudForm = z.infer<typeof addWANCloudSchema>;

interface WANCloud {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  color: string;
}

interface AddWANCloudDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (cloud: Omit<WANCloud, 'id'>) => void;
}

export default function AddWANCloudDialog({ 
  open, 
  onClose, 
  onAdd 
}: AddWANCloudDialogProps) {
  
  const form = useForm<AddWANCloudForm>({
    resolver: zodResolver(addWANCloudSchema),
    defaultValues: {
      name: '',
      type: '',
      color: '#10b981',
    },
  });

  const onSubmit = (data: AddWANCloudForm) => {
    // Add the cloud at a random position in the center area
    const cloud = {
      ...data,
      x: 0.3 + Math.random() * 0.4, // Random position in center 40%
      y: 0.3 + Math.random() * 0.4,
    };
    
    onAdd(cloud);
    form.reset();
    onClose();
  };

  const cloudTypes = [
    'Private Cloud',
    'Private Backbone',
    'Hybrid Cloud',
    'Multi-Cloud',
    'Edge Network',
    'CDN',
    'Carrier Cloud',
    'Regional Network',
    'Backup Network',
    'Test Network',
    'Custom Network'
  ];

  const cloudColors = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Gray', value: '#6b7280' }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add WAN Cloud</DialogTitle>
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
                    <Input {...field} placeholder="e.g. Private Cloud 1" data-testid="input-cloud-name" />
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
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cloud Color</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-cloud-color">
                        <SelectValue placeholder="Select color" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cloudColors.map(color => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded border border-gray-300" 
                              style={{ backgroundColor: color.value }}
                            />
                            {color.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" data-testid="button-add-cloud">
                Add Cloud
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}