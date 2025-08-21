import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Circuit } from '@shared/schema';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';

const circuitEditSchema = z.object({
  circuitId: z.string().min(1, 'Circuit ID is required'),
  siteName: z.string().min(1, 'Site name is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  bandwidth: z.string().min(1, 'Bandwidth is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  monthlyCost: z.string().min(1, 'Monthly cost is required'),
  aLocation: z.string().optional(),
  zLocation: z.string().optional(),
  contractEndDate: z.string().optional(),
  notes: z.string().optional(),
  // NaaS (optional)
  naasEnabled: z.boolean().optional(),
  naasProvider: z.string().optional(),
  naasPopId: z.string().optional(),
  naasPopName: z.string().optional(),
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
  const [showCustomCarrier, setShowCustomCarrier] = React.useState(false);

  // Resolve current project id from URL or localStorage (for sites list)
  const currentProjectId = React.useMemo(() => {
    const pathParts = window.location.pathname.split('/');
    const projectIndex = pathParts.indexOf('projects');
    const fromPath = projectIndex !== -1 && projectIndex < pathParts.length - 1 ? pathParts[projectIndex + 1] : '';
    return fromPath || localStorage.getItem('currentProjectId') || '';
  }, []);

  // Fetch sites to offer in the siteName dropdown
  const { data: sites = [] } = useQuery({
    queryKey: ['/api/sites', currentProjectId, open],
    queryFn: async () => {
      const response = await fetch(`/api/sites?projectId=${currentProjectId}`);
      if (!response.ok) throw new Error('Failed to fetch sites');
      return response.json();
    },
    enabled: !!currentProjectId && open,
  });
  const form = useForm<CircuitEditForm>({
    resolver: zodResolver(circuitEditSchema),
    defaultValues: {
      circuitId: circuit?.circuitId || '',
      siteName: circuit?.siteName || '',
      serviceType: circuit?.serviceType || '',
      bandwidth: circuit?.bandwidth || '',
      carrier: circuit?.carrier || '',
      monthlyCost: (circuit?.monthlyCost as unknown as string) || '0',
      aLocation: circuit?.aLocation || '',
      zLocation: circuit?.zLocation || '',
      contractEndDate: circuit?.contractEndDate ? new Date(circuit.contractEndDate).toISOString().split('T')[0] : '',
      notes: circuit?.notes || '',
      naasEnabled: (circuit as any)?.naasEnabled || false,
      naasProvider: (circuit as any)?.naasProvider || '',
      naasPopId: (circuit as any)?.naasPopId || '',
      naasPopName: (circuit as any)?.naasPopName || '',
    },
  });

  React.useEffect(() => {
    if (circuit) {
      form.reset({
        circuitId: circuit.circuitId,
        siteName: circuit.siteName,
        serviceType: circuit.serviceType,
        bandwidth: circuit.bandwidth,
        carrier: circuit.carrier,
        monthlyCost: (circuit.monthlyCost as unknown as string) || '0',
        aLocation: circuit.aLocation || '',
        zLocation: circuit.zLocation || '',
        contractEndDate: circuit.contractEndDate ? new Date(circuit.contractEndDate).toISOString().split('T')[0] : '',
        notes: circuit.notes || '',
        naasEnabled: (circuit as any)?.naasEnabled || false,
        naasProvider: (circuit as any)?.naasProvider || '',
        naasPopId: (circuit as any)?.naasPopId || '',
        naasPopName: (circuit as any)?.naasPopName || '',
      });

      // Initialize custom carrier mode if the value isn't in our common list
      setShowCustomCarrier(!commonCarriers.includes(circuit.carrier));
    }
  }, [circuit, form]);

  const onSubmit = (data: CircuitEditForm) => {
    if (!circuit) return;
    
    onSave(circuit.id, {
      circuitId: data.circuitId,
      siteName: data.siteName,
      serviceType: data.serviceType,
      bandwidth: data.bandwidth,
      carrier: data.carrier,
      // Send as string to satisfy Partial<Circuit> typing where monthlyCost is decimal-backed string
      monthlyCost: data.monthlyCost,
      aLocation: data.aLocation || undefined,
      zLocation: data.zLocation || undefined,
      // Send Date|null per Circuit typing
      contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
      notes: data.notes || undefined,
      // NaaS
      naasEnabled: !!data.naasEnabled,
      // When disabled, explicitly clear related fields to null to avoid stale values in DB
      naasProvider: data.naasEnabled ? (data.naasProvider || null) : null,
      naasPopId: data.naasEnabled ? (data.naasPopId || null) : null,
      naasPopName: data.naasEnabled ? (data.naasPopName || null) : null,
      naasMetadata: data.naasEnabled ? undefined : null,
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

  // Match Add Circuit service types
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
    'SD-WAN'
  ];

  const circuitCategories = [
    'Internet',
    'Private',
    'Point-to-Point',
    'Cloud Connect',
    'Backup'
  ];

  // Common carriers list (align with Add Circuit)
  const commonCarriers = [
    'Verizon',
    'AT&T',
    'T-Mobile',
    'Comcast Business',
    'Charter Spectrum Business',
    'CenturyLink/Lumen',
    'Cox Business',
    'Frontier Communications',
    'Windstream',
    'TDS Telecom'
  ];

  // Fetch Megaport POP locations (with empty->refresh fallback)
  const { data: megaportPOPs = [] } = useQuery({
    queryKey: ['/api/megaport/locations'],
    queryFn: async () => {
      const res = await fetch('/api/megaport/locations');
      if (!res.ok) throw new Error('Failed to fetch Megaport locations');
      const data = await res.json();
      if (Array.isArray(data) && data.length === 0) {
        const res2 = await fetch('/api/megaport/locations?refresh=1');
        if (!res2.ok) return data;
        const data2 = await res2.json();
        return Array.isArray(data2) && data2.length > 0 ? data2 : data;
      }
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

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
            {/* NaaS Onramp (Inventory) - moved to top for visibility */}
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={!!form.watch('naasEnabled')}
                  onCheckedChange={(checked) => form.setValue('naasEnabled', !!checked)}
                  id="naasEnabled"
                  data-testid="checkbox-naas-enabled"
                />
                <label htmlFor="naasEnabled" className="text-sm font-medium">Use NaaS onramp for this circuit</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="naasProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NaaS Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!form.watch('naasEnabled')}>
                        <FormControl>
                          <SelectTrigger data-testid="select-naas-provider">
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Megaport">Megaport</SelectItem>
                          <SelectItem value="Equinix">Equinix</SelectItem>
                          <SelectItem value="Cato">Cato</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('naasEnabled') && form.watch('naasProvider') === 'Megaport' && (
                  <FormField
                    control={form.control}
                    name="naasPopName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Megaport POP</FormLabel>
                        <div className="border rounded-md" data-testid="command-naas-pop">
                          <Command>
                            <CommandInput placeholder="Type a city or POP name..." />
                            <CommandList className="max-h-72">
                              <CommandEmpty>No Megaport locations found.</CommandEmpty>
                              {Array.isArray(megaportPOPs) && megaportPOPs.map((pop: any) => {
                                const label = `${pop.name} (${pop.city}, ${pop.country})`;
                                return (
                                  <CommandItem
                                    key={pop.id}
                                    value={`${pop.city} ${pop.country} ${pop.name}`}
                                    onSelect={() => {
                                      form.setValue('naasPopId', pop.id);
                                      field.onChange(label);
                                    }}
                                  >
                                    {label}
                                  </CommandItem>
                                );
                              })}
                            </CommandList>
                          </Command>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-site-name">
                          <SelectValue placeholder="Select existing site or enter manually" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sites.map((site: any) => (
                          <SelectItem key={site.id} value={site.name}>
                            {site.name} - {site.location}
                          </SelectItem>
                        ))}
                        <SelectItem value="manual">Manual Entry (New Site)</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.value === 'manual' && (
                      <Input 
                        placeholder="Enter new site name" 
                        onChange={(e) => field.onChange(e.target.value)}
                        className="mt-2"
                      />
                    )}
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
                    <Select 
                      onValueChange={(value) => {
                        if (value === 'custom') {
                          setShowCustomCarrier(true);
                          field.onChange('');
                        } else {
                          setShowCustomCarrier(false);
                          field.onChange(value);
                        }
                      }}
                      value={showCustomCarrier ? 'custom' : field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-carrier">
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {commonCarriers.map((carrier) => (
                          <SelectItem key={carrier} value={carrier}>
                            {carrier}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Add Custom Carrier</SelectItem>
                      </SelectContent>
                    </Select>
                    {showCustomCarrier && (
                      <Input
                        placeholder="Enter carrier name"
                        className="mt-2"
                        data-testid="input-custom-carrier"
                        onChange={(e) => {
                          field.onChange(e.target.value);
                        }}
                        value={field.value}
                      />
                    )}
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

            {/* Location Type removed to match Add Circuit */}

            {/* Point-to-Point locations */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="aLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>A Location (auto-filled for P2P)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Auto-filled from site" 
                        value={form.watch('serviceType')?.includes('Point') || form.watch('serviceType')?.includes('Private Line') || form.watch('serviceType')?.includes('Dark Fiber') ? form.watch('siteName') : field.value}
                        readOnly={form.watch('serviceType')?.includes('Point') || form.watch('serviceType')?.includes('Private Line') || form.watch('serviceType')?.includes('Dark Fiber')}
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
                    {/* Megaport POP searchable typeahead */}
                    <div className="mt-2 border rounded-md">
                      <Command>
                        <CommandInput placeholder="Type a city or POP name..." />
                        <CommandList className="max-h-72">
                          <CommandEmpty>No Megaport locations found.</CommandEmpty>
                          {Array.isArray(megaportPOPs) && megaportPOPs.map((pop: any) => {
                            const label = `${pop.name} (${pop.city}, ${pop.country})`;
                            return (
                              <CommandItem
                                key={pop.id}
                                value={`${pop.city} ${pop.country} ${pop.name}`}
                                onSelect={() => field.onChange(label)}
                              >
                                {label}
                              </CommandItem>
                            );
                          })}
                        </CommandList>
                      </Command>
                    </div>
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