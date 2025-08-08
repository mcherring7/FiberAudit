import { useState } from "react";
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
import { Circuit } from '@shared/schema';

const addCircuitSchema = z.object({
  circuitId: z.string().min(1, 'Circuit ID is required'),
  siteName: z.string().min(1, 'Site name is required'),
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

type AddCircuitForm = z.infer<typeof addCircuitSchema>;

interface AddCircuitDialogProps {
  open: boolean;
  onClose: () => void;
  initialSiteName?: string;
  templateCircuit?: Circuit;
}

export default function AddCircuitDialog({ open, onClose, initialSiteName, templateCircuit }: AddCircuitDialogProps) {
  const queryClient = useQueryClient();
  
  const form = useForm<AddCircuitForm>({
    resolver: zodResolver(addCircuitSchema),
    defaultValues: {
      circuitId: '',
      siteName: templateCircuit?.siteName || initialSiteName || '',
      serviceType: templateCircuit?.serviceType || '',
      bandwidth: templateCircuit?.bandwidth || '',
      carrier: templateCircuit?.carrier || '',
      monthlyCost: templateCircuit?.monthlyCost?.toString() || '',
      locationType: templateCircuit?.locationType || 'Branch',
      aLocation: templateCircuit?.aLocation || '',
      zLocation: templateCircuit?.zLocation || '',
      contractEndDate: templateCircuit?.contractEndDate ? 
        (templateCircuit.contractEndDate instanceof Date ? 
          templateCircuit.contractEndDate.toISOString().split('T')[0] : 
          templateCircuit.contractEndDate.split('T')[0]) : '',
      notes: templateCircuit?.notes || '',
    },
  });

  const addCircuitMutation = useMutation({
    mutationFn: async (data: AddCircuitForm) => {
      const response = await fetch('/api/circuits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
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
        throw new Error(`Failed to add circuit: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/circuits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      form.reset();
      onClose();
    },
    onError: (error) => {
      console.error('Add circuit error:', error);
    },
  });

  const onSubmit = (data: AddCircuitForm) => {
    addCircuitMutation.mutate(data);
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Circuit</DialogTitle>
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
                      <Input {...field} data-testid="input-circuit-id" />
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
                      <Input {...field} data-testid="input-site-name" />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-service-type">
                          <SelectValue placeholder="Select service type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-location-type">
                          <SelectValue placeholder="Select location type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locationTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="carrier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-carrier" />
                    </FormControl>
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
                      <Input {...field} placeholder="e.g., 100Mbps, 1Gbps" data-testid="input-bandwidth" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthlyCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Cost ($)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" data-testid="input-monthly-cost" />
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
                    <FormLabel>Contract End Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" data-testid="input-contract-end-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="aLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A Location (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="For P2P circuits" data-testid="input-a-location" />
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
                    <FormLabel>Z Location (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="For P2P circuits" data-testid="input-z-location" />
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
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} data-testid="textarea-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={addCircuitMutation.isPending}
                data-testid="button-add-circuit"
              >
                {addCircuitMutation.isPending ? 'Adding...' : 'Add Circuit'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}