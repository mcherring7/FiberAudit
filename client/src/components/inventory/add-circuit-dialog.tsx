import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Circuit } from '@shared/schema';

const addCircuitSchema = z.object({
  circuitId: z.string().min(1, 'Circuit ID is required'),
  siteName: z.string().min(1, 'Site name is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  bandwidth: z.string().min(1, 'Bandwidth is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  customCarrier: z.string().optional(),
  monthlyCost: z.string().min(1, 'Monthly cost is required'),
  aLocation: z.string().optional(),
  zLocation: z.string().optional(),
  showZLocation: z.boolean().optional(),
  contractEndDate: z.string().optional(),
  notes: z.string().optional(),
  siteFeatures: z.array(z.string()).optional(),
  // NaaS onramp fields (optional)
  naasEnabled: z.boolean().optional(),
  naasProvider: z.string().optional(),
  naasPopId: z.string().optional(),
  naasPopName: z.string().optional(),
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
  const [showCustomCarrier, setShowCustomCarrier] = useState(false);

  // Get current project ID from localStorage first (app stores it),
  // and fall back to URL parsing if present
  const currentProjectId = useMemo(() => {
    const fromStorage = localStorage.getItem('currentProjectId');
    if (fromStorage) return fromStorage;
    const pathParts = window.location.pathname.split('/');
    const projectIndex = pathParts.indexOf('projects');
    if (projectIndex !== -1 && projectIndex < pathParts.length - 1) {
      return pathParts[projectIndex + 1];
    }
    return '';
  }, []);

  // Fetch existing sites for this project
  const { data: sites = [] } = useQuery({
    queryKey: ['/api/sites', currentProjectId],
    queryFn: async () => {
      const response = await fetch(`/api/sites?projectId=${currentProjectId}`);
      if (!response.ok) throw new Error('Failed to fetch sites');
      return response.json();
    },
    enabled: !!currentProjectId && open,
  });

  // Fetch Megaport POP locations (with empty->refresh fallback)
  const { data: megaportPOPs = [] } = useQuery({
    queryKey: ['/api/megaport/locations'],
    queryFn: async () => {
      const res = await fetch('/api/megaport/locations');
      if (!res.ok) throw new Error('Failed to fetch Megaport locations');
      const data = await res.json();
      if (Array.isArray(data) && data.length === 0) {
        // Try forcing a refresh to rebuild server cache
        const res2 = await fetch('/api/megaport/locations?refresh=1');
        if (!res2.ok) return data;
        const data2 = await res2.json();
        return Array.isArray(data2) && data2.length > 0 ? data2 : data;
      }
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Top 10 US telecom carriers
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

  // Site feature options
  const siteFeatureOptions = [
    { id: 'redundant_circuits', label: 'Redundant Circuits' },
    { id: 'sdwan_enabled', label: 'SD-WAN Enabled' },
    { id: 'vpn_concentrator', label: 'VPN Concentrator' },
    { id: 'hub_site', label: 'HUB Site' },
    { id: 'backup_internet', label: 'Backup Internet' },
    { id: 'pri_voice', label: 'PRI Voice' },
    { id: 'firewall', label: 'Firewall' },
    { id: 'load_balancer', label: 'Load Balancer' }
  ];

  const form = useForm<AddCircuitForm>({
    resolver: zodResolver(addCircuitSchema),
    defaultValues: {
      circuitId: '',
      siteName: '',
      serviceType: '',
      bandwidth: '',
      carrier: '',
      customCarrier: '',
      monthlyCost: '',
      aLocation: '',
      zLocation: '',
      showZLocation: false,
      contractEndDate: '',
      notes: '',
      siteFeatures: [],
    },
  });

  // Reset form when template circuit or dialog state changes
  useEffect(() => {
    if (open) {
      form.reset({
        circuitId: '',
        siteName: templateCircuit?.siteName || initialSiteName || localStorage.getItem('lastSelectedSiteName') || '',
        serviceType: templateCircuit?.serviceType || '',
        bandwidth: templateCircuit?.bandwidth || '',
        carrier: templateCircuit?.carrier || '',
        customCarrier: '',
        monthlyCost: templateCircuit?.monthlyCost?.toString() || '',
        aLocation: templateCircuit?.aLocation || '',
        zLocation: templateCircuit?.zLocation || '',
        // Keep toggle off by default when opening dialog
        showZLocation: false,
        siteFeatures: (templateCircuit?.siteFeatures as string[]) || [],
        contractEndDate: templateCircuit?.contractEndDate ? 
          (templateCircuit.contractEndDate instanceof Date ? 
            templateCircuit.contractEndDate.toISOString().split('T')[0] : 
            typeof templateCircuit.contractEndDate === 'string' ? 
              new Date(templateCircuit.contractEndDate).toISOString().split('T')[0] : '') : '',
        notes: templateCircuit?.notes || '',
        naasEnabled: (templateCircuit as any)?.naasEnabled || false,
        naasProvider: (templateCircuit as any)?.naasProvider || '',
        naasPopId: (templateCircuit as any)?.naasPopId || '',
        naasPopName: (templateCircuit as any)?.naasPopName || '',
      });
    }
  }, [open, templateCircuit, initialSiteName, form]);

  const addCircuitMutation = useMutation({
    mutationFn: async (data: AddCircuitForm) => {
      const response = await fetch('/api/circuits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          projectId: currentProjectId,
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
          contractEndDate: data.contractEndDate && data.contractEndDate !== 'tbd' ? new Date(data.contractEndDate).toISOString() : undefined,
          siteFeatures: data.siteFeatures || [],
          // NaaS fields - only include when enabled/selected
          naasEnabled: !!data.naasEnabled,
          naasProvider: data.naasEnabled ? (data.naasProvider || undefined) : undefined,
          naasPopId: data.naasEnabled ? (data.naasPopId || undefined) : undefined,
          naasPopName: data.naasEnabled ? (data.naasPopName || undefined) : undefined,
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
    'SD-WAN'
  ];

  // Removed location type; sites capture this attribute in Sites management

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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-site-name">
                          <SelectValue placeholder="Select existing site or add manually" />
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

            {/* NaaS Onramp (Inventory) */}
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="carrier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setShowCustomCarrier(true);
                          field.onChange("");
                        } else {
                          setShowCustomCarrier(false);
                          field.onChange(value);
                        }
                      }} 
                      value={showCustomCarrier ? "custom" : field.value}
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
                    <div className="flex gap-2">
                      <Select 
                        onValueChange={(value) => {
                          if (value === 'tbd') {
                            field.onChange('tbd');
                          } else if (value === 'date') {
                            field.onChange('');
                          }
                        }}
                        value={field.value === 'tbd' ? 'tbd' : field.value ? 'date' : 'select'}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Specific Date</SelectItem>
                          <SelectItem value="tbd">TBD</SelectItem>
                        </SelectContent>
                      </Select>
                      {field.value !== 'tbd' && (
                        <FormControl>
                          <Input 
                            {...field} 
                            type="date" 
                            data-testid="input-contract-end-date"
                            className="flex-1"
                          />
                        </FormControl>
                      )}
                    </div>
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

              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id="showZLocation"
                    checked={!!form.watch('showZLocation')}
                    onCheckedChange={(checked) => {
                      const val = !!checked;
                      form.setValue('showZLocation', val);
                      if (!val) form.setValue('zLocation', '');
                    }}
                  />
                  <label htmlFor="showZLocation" className="text-sm font-medium">Specify Z Location</label>
                </div>
                {form.watch('showZLocation') && (
                  <FormField
                    control={form.control}
                    name="zLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Z Location (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="For P2P circuits" data-testid="input-z-location" />
                        </FormControl>
                        {/* Megaport POP searchable typeahead */}
                        <div className="mt-2 border rounded-md" data-testid="command-megaport-pop">
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
                )}
              </div>
            </div>

            {/* Custom Carrier Input */}
            {showCustomCarrier && (
              <FormField
                control={form.control}
                name="customCarrier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Carrier Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter carrier name" 
                        data-testid="input-custom-carrier"
                        onChange={(e) => {
                          field.onChange(e);
                          form.setValue("carrier", e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Site Features */}
            <FormField
              control={form.control}
              name="siteFeatures"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site Features</FormLabel>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {siteFeatureOptions.map((feature) => (
                      <div key={feature.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={feature.id}
                          checked={field.value?.includes(feature.id)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, feature.id]);
                            } else {
                              field.onChange(current.filter((id: string) => id !== feature.id));
                            }
                          }}
                          data-testid={`checkbox-${feature.id}`}
                        />
                        <label htmlFor={feature.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {feature.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

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