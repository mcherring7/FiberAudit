import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Circuit } from '@shared/schema';

const circuitEditSchema = z.object({
  circuitId: z.string().min(1, 'Circuit ID is required'),
  siteName: z.string().min(1, 'Site name is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  circuitCategory: z.string().min(1, 'Circuit category is required'),
  bandwidth: z.string().min(1, 'Bandwidth is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  monthlyCost: z.string().transform((val) => parseFloat(val)),
  locationType: z.string().optional(),
  aLocation: z.string().optional(),
  zLocation: z.string().optional(),
  contractEndDate: z.string().optional(),
  notes: z.string().optional(),
});

type CircuitEditForm = z.infer<typeof circuitEditSchema>;

interface CircuitEditDialogProps {
  circuit: Circuit | null;
  open: boolean;
  onClose: () => void;
  onSave: (circuitId: string, updates: Partial<Circuit>) => void;
  onDelete?: (circuitId: string) => void;
}

export default function CircuitEditDialog({ 
  circuit, 
  open, 
  onClose, 
  onSave, 
  onDelete 
}: CircuitEditDialogProps) {
  const form = useForm<CircuitEditForm>({
    resolver: zodResolver(circuitEditSchema),
    defaultValues: {
      circuitId: circuit?.circuitId || '',
      siteName: circuit?.siteName || '',
      serviceType: circuit?.serviceType || '',
      circuitCategory: circuit?.circuitCategory || '',
      bandwidth: circuit?.bandwidth || '',
      carrier: circuit?.carrier || '',
      monthlyCost: circuit?.monthlyCost?.toString() || '0',
      locationType: circuit?.locationType || '',
      aLocation: circuit?.aLocation || '',
      zLocation: circuit?.zLocation || '',
      contractEndDate: circuit?.contractEndDate || '',
      notes: circuit?.notes || '',
    },
  });

  React.useEffect(() => {
    if (circuit) {
      form.reset({
        circuitId: circuit.circuitId,
        siteName: circuit.siteName,
        serviceType: circuit.serviceType,
        circuitCategory: circuit.circuitCategory,
        bandwidth: circuit.bandwidth,
        carrier: circuit.carrier,
        monthlyCost: circuit.monthlyCost?.toString() || '0',
        locationType: circuit.locationType || '',
        aLocation: circuit.aLocation || '',
        zLocation: circuit.zLocation || '',
        contractEndDate: circuit.contractEndDate || '',
        notes: circuit.notes || '',
      });
    }
  }, [circuit, form]);

  const onSubmit = (data: CircuitEditForm) => {
    if (!circuit) return;
    
    onSave(circuit.id, {
      circuitId: data.circuitId,
      siteName: data.siteName,
      serviceType: data.serviceType,
      circuitCategory: data.circuitCategory,
      bandwidth: data.bandwidth,
      carrier: data.carrier,
      monthlyCost: data.monthlyCost,
      locationType: data.locationType || undefined,
      aLocation: data.aLocation || undefined,
      zLocation: data.zLocation || undefined,
      contractEndDate: data.contractEndDate || undefined,
      notes: data.notes || undefined,
    });
    
    onClose();
  };

  const handleDelete = () => {
    if (!circuit || !onDelete) return;
    
    if (confirm(`Are you sure you want to delete circuit "${circuit.circuitId}"? This action cannot be undone.`)) {
      onDelete(circuit.id);
      onClose();
    }
  };

  if (!circuit) return null;

  const serviceTypes = [
    'Broadband',
    'Dedicated Internet',
    'MPLS',
    'VPLS', 
    'Private Line',
    'Dark Fiber',
    'LTE',
    'Satellite',
    'Direct Connect',
    'SD-WAN',
    'Other'
  ];

  const circuitCategories = [
    'Internet',
    'Private',
    'Point-to-Point',
    'Cloud Connect',
    'Backup'
  ];

  const locationTypes = [
    'Branch',
    'Corporate',
    'Data Center',
    'Cloud'
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="dialog-circuit-edit">
        <DialogHeader>
          <DialogTitle>Edit Circuit: {circuit.circuitId}</DialogTitle>
          <DialogDescription>
            Modify circuit properties including service type, bandwidth, and carrier information
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="circuitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Circuit ID</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter circuit ID"
                        data-testid="input-circuit-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siteName"
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-service-type">
                          <SelectValue placeholder="Select service type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceTypes.map(type => (
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
                name="circuitCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Circuit Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-circuit-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {circuitCategories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="bandwidth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bandwidth</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., 100 Mbps"
                        data-testid="input-bandwidth"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="carrier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter carrier name"
                        data-testid="input-carrier"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthlyCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Cost ($)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        step="0.01"
                        min="0"
                        data-testid="input-monthly-cost"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="locationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Type (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-location-type">
                        <SelectValue placeholder="Select location type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locationTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Point-to-Point locations */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="aLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A Location (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Point A location"
                        data-testid="input-a-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Z Location (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Point Z location"
                        data-testid="input-z-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contractEndDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contract End Date (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="date"
                      data-testid="input-contract-end-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Additional notes about this circuit..."
                      rows={3}
                      data-testid="textarea-circuit-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex justify-between">
              <div>
                {onDelete && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={handleDelete}
                    data-testid="button-delete-circuit"
                  >
                    Delete Circuit
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
                  data-testid="button-save-circuit"
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