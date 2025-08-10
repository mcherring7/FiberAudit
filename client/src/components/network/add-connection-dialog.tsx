import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const addConnectionSchema = z.object({
  circuitId: z.string().min(1, 'Circuit ID is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  bandwidth: z.string().min(1, 'Bandwidth is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  monthlyCost: z.string().min(1, 'Monthly cost is required'),
  locationType: z.string().optional(),
  aLocation: z.string().optional(),
  zLocation: z.string().optional(),
  contractEndDate: z.string().optional(),
  notes: z.string().optional(),
});

type AddConnectionForm = z.infer<typeof addConnectionSchema>;

interface Site {
  id: string;
  name: string;
  location: string;
  category: "Branch" | "Corporate" | "Data Center" | "Cloud";
}

interface AddConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  selectedSite?: Site | null;
  connectionType?: string;
}

export default function AddConnectionDialog({ 
  open, 
  onClose, 
  selectedSite,
  connectionType 
}: AddConnectionDialogProps) {
  const queryClient = useQueryClient();
  
  const form = useForm<AddConnectionForm>({
    resolver: zodResolver(addConnectionSchema),
    defaultValues: {
      circuitId: '',
      serviceType: '',
      bandwidth: '',
      carrier: '',
      monthlyCost: '',
      locationType: 'Branch',
      aLocation: '',
      zLocation: '',
      contractEndDate: '',
      notes: '',
    },
  });

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open && selectedSite) {
      form.reset({
        circuitId: '',
        serviceType: getDefaultServiceType(connectionType),
        bandwidth: '',
        carrier: '',
        monthlyCost: '',
        locationType: selectedSite.category || 'Branch',
        aLocation: '',
        zLocation: '',
        contractEndDate: '',
        notes: '',
      });
    }
  }, [open, selectedSite, connectionType, form]);

  const getDefaultServiceType = (type?: string): string => {
    if (!type) return '';
    
    const typeMap: Record<string, string> = {
      'internet': 'Dedicated Internet',
      'mpls': 'MPLS',
      'vpls': 'VPLS',
      'point-to-point': 'Private Line',
      'aws': 'AWS Direct Connect',
      'azure': 'Azure ExpressRoute',
      'naas': 'NaaS'
    };
    
    return typeMap[type.toLowerCase()] || '';
  };

  const addConnectionMutation = useMutation({
    mutationFn: async (data: AddConnectionForm) => {
      const response = await fetch('/api/circuits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          siteName: selectedSite?.name || '',
          projectId: 'project-1',
          monthlyCost: parseFloat(data.monthlyCost),
          // Extract bandwidth numeric value
          bandwidthMbps: (() => {
            const match = data.bandwidth.match(/(\d+(?:\.\d+)?)/);
            let mbps = match ? parseFloat(match[1]) : 0;
            if (data.bandwidth.toLowerCase().includes('gbps')) {
              mbps *= 1000;
            }
            return mbps;
          })(),
          contractEndDate: data.contractEndDate ? new Date(data.contractEndDate).toISOString() : undefined,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add connection: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/circuits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      form.reset();
      onClose();
    },
  });

  const onSubmit = (data: AddConnectionForm) => {
    addConnectionMutation.mutate(data);
  };

  const serviceTypes = [
    'Broadband',
    'Dedicated Internet',
    'LTE',
    'Satellite',
    'MPLS',
    'VPLS',
    'Private Line',
    'Wavelength',
    'Dark Fiber',
    'AWS Direct Connect',
    'Azure ExpressRoute',
    'SD-WAN',
    'NaaS'
  ];

  const locationTypes = [
    'Branch',
    'Corporate',
    'Data Center',
    'Cloud'
  ];

  if (!selectedSite) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Connection to {selectedSite.name}</DialogTitle>
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
                      <Input {...field} placeholder="e.g. CKT-001" data-testid="input-circuit-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                name="bandwidth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bandwidth</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 100Mbps" data-testid="input-bandwidth" />
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
                      <Input {...field} placeholder="e.g. Verizon" data-testid="input-carrier" />
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
                      <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-monthly-cost" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Type</FormLabel>
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

              <FormField
                control={form.control}
                name="aLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A Location (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="For P2P connections" data-testid="input-a-location" />
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
                      <Input {...field} placeholder="For P2P connections" data-testid="input-z-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contractEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract End Date (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" data-testid="input-contract-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Additional notes..." data-testid="textarea-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={addConnectionMutation.isPending}
                data-testid="button-add-connection"
              >
                {addConnectionMutation.isPending ? 'Adding...' : 'Add Connection'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}