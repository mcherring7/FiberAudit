import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Circuit } from '@shared/schema';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const circuitEditSchema = z.object({
  circuitId: z.string().min(1, 'Circuit ID is required'),
  siteName: z.string().min(1, 'Site name is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  bandwidth: z.string().min(1, 'Bandwidth is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  monthlyCost: z.string().min(1, 'Monthly cost is required'),
  aLocation: z.string().optional(),
  zLocation: z.string().optional(),
  showZLocation: z.boolean().optional(),
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
  const queryClient = useQueryClient();

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

  const refreshEquinixPOPs = React.useCallback(async () => {
    try {
      await fetch('/api/equinix/fabric/locations?refresh=1');
    } catch (e) {
      // ignore
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['/api/equinix/fabric/locations'] });
    }
  }, [queryClient]);

  // Fetch Equinix Fabric POP locations: prefer public dataset, then API, then refresh
  const { data: equinixPOPs = [] } = useQuery({
    queryKey: ['/api/equinix/fabric/locations'],
    queryFn: async () => {
      // 1) Try public dataset
      try {
        const pubRes = await fetch('/data/equinix_ibx.json', { cache: 'no-cache' });
        if (pubRes.ok) {
          const pub = await pubRes.json();
          if (Array.isArray(pub) && pub.length > 0) return pub;
        }
      } catch {}

      // 2) Fallback to API
      const res = await fetch('/api/equinix/fabric/locations');
      if (!res.ok) throw new Error('Failed to fetch Equinix Fabric locations');
      const text = await res.text();
      let data: any = [];
      try { data = JSON.parse(text); } catch { data = []; }
      if (Array.isArray(data) && data.length === 0) {
        const res2 = await fetch('/api/equinix/fabric/locations?refresh=1');
        if (!res2.ok) return data;
        const text2 = await res2.text();
        let data2: any = [];
        try { data2 = JSON.parse(text2); } catch { data2 = []; }
        return Array.isArray(data2) && data2.length > 0 ? data2 : data;
      }
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Static fallback so UI always has options even if server route isn't ready
  const EQUINIX_FALLBACK = React.useMemo(() => ([
    { id: 'SV1', name: 'SV1 - Silicon Valley', provider: 'Equinix' },
    { id: 'NY5', name: 'NY5 - New York', provider: 'Equinix' },
    { id: 'LD5', name: 'LD5 - London', provider: 'Equinix' },
    { id: 'SY4', name: 'SY4 - Sydney', provider: 'Equinix' },
    { id: 'TY2', name: 'TY2 - Tokyo', provider: 'Equinix' },
  ]), []);

  // Searchable dialogs state
  const [showEquinixSearch, setShowEquinixSearch] = React.useState(false);
  const [showMegaportSearch, setShowMegaportSearch] = React.useState(false);
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
      // Default to off by default, regardless of prior value
      showZLocation: false,
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
        // Keep toggle off by default when opening dialog
        showZLocation: false,
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
      // Clear Z when toggle is off
      zLocation: data.showZLocation ? (data.zLocation || null) : null,
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

  // Fetch Megaport POP locations: prefer public dataset, then API, then refresh
  const { data: megaportPOPs = [] } = useQuery({
    queryKey: ['/api/megaport/locations'],
    queryFn: async () => {
      // 1) Try public dataset
      try {
        const pubRes = await fetch('/data/megaport_pops.json', { cache: 'no-cache' });
        if (pubRes.ok) {
          const pub = await pubRes.json();
          if (Array.isArray(pub) && pub.length > 0) return pub;
        }
      } catch {}

      // 2) Fallback to API
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

            {/* Service Type */}
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

            {/* NaaS Onramp - directly under Bandwidth | Carrier | Monthly Cost */}
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="naasEnabled"
                  data-testid="checkbox-naas-enabled"
                  checked={!!form.watch('naasEnabled')}
                  onCheckedChange={(checked) => {
                    const enabled = !!checked;
                    form.setValue('naasEnabled', enabled);
                    if (!enabled) {
                      form.setValue('naasProvider', '');
                      form.setValue('naasPopId', '');
                      form.setValue('naasPopName', '');
                    }
                  }}
                />
                <Label htmlFor="naasEnabled" className="text-sm font-medium">
                  Use NaaS onramp for this circuit
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="naasProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NaaS Provider</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          // Clear POP if provider changes
                          form.setValue('naasPopId', '');
                          form.setValue('naasPopName', '');
                        }}
                        value={field.value}
                        disabled={!form.watch('naasEnabled')}
                      >
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
                        <div className="flex items-center justify-between gap-2">
                          <FormLabel>Megaport POP</FormLabel>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={async () => {
                              try { await fetch('/api/megaport/locations?refresh=1'); } catch {}
                              await queryClient.invalidateQueries({ queryKey: ['/api/megaport/locations'] });
                            }}>
                              Refresh POPs
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setShowMegaportSearch(true)}>
                              Search
                            </Button>
                          </div>
                        </div>
                        <Select
                          value={form.watch('naasPopId') || ''}
                          onValueChange={(id) => {
                            const pop = Array.isArray(megaportPOPs)
                              ? (megaportPOPs as any[]).find((p) => p.id === id)
                              : undefined;
                            const label = pop ? `${pop.name} (${pop.city}, ${pop.country})` : '';
                            form.setValue('naasPopId', id);
                            field.onChange(label);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-naas-pop">
                              <SelectValue placeholder="Select POP" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(megaportPOPs) && (megaportPOPs as any[]).map((pop) => (
                              <SelectItem key={pop.id} value={pop.id}>
                                {`${pop.name} (${pop.city}, ${pop.country})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {form.watch('naasEnabled') && form.watch('naasProvider') === 'Equinix' && (
                  <FormField
                    control={form.control}
                    name="naasPopName"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-2">
                          <FormLabel>Equinix Fabric POP (IBX)</FormLabel>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={refreshEquinixPOPs}>
                              Refresh IBX
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setShowEquinixSearch(true)}>
                              Search
                            </Button>
                          </div>
                        </div>
                        <Select
                          value={form.watch('naasPopId') || ''}
                          onValueChange={(id) => {
                            const list = (Array.isArray(equinixPOPs) && equinixPOPs.length > 0)
                              ? (equinixPOPs as any[])
                              : (EQUINIX_FALLBACK as any[]);
                            const pop = list.find((p) => p.id === id);
                            // Server returns { id: IBX, name: "IBX - Metro", metro?: string }
                            const label = pop ? (pop.name || pop.id) : '';
                            form.setValue('naasPopId', id);
                            field.onChange(label);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-naas-pop-equinix">
                              <SelectValue placeholder="Select Equinix IBX" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {((Array.isArray(equinixPOPs) && equinixPOPs.length > 0)
                              ? (equinixPOPs as any[])
                              : (EQUINIX_FALLBACK as any[])).map((pop) => (
                              <SelectItem key={pop.id} value={pop.id}>
                                {pop.name || pop.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {Array.isArray(equinixPOPs) && equinixPOPs.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">Using fallback IBX list. Try Refresh IBX to load live data.</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Searchable Equinix IBX Combobox */}
                {form.watch('naasEnabled') && form.watch('naasProvider') === 'Equinix' && (
                  <CommandDialog open={showEquinixSearch} onOpenChange={setShowEquinixSearch}>
                    <CommandInput placeholder="Type to search all Equinix IBX..." />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup heading="IBX">
                        {((Array.isArray(equinixPOPs) && equinixPOPs.length > 0)
                          ? (equinixPOPs as any[])
                          : (EQUINIX_FALLBACK as any[])).map((pop) => (
                          <CommandItem
                            key={pop.id}
                            value={`${pop.id} ${pop.name || ''}`}
                            onSelect={() => {
                              const label = pop?.name || pop?.id || '';
                              form.setValue('naasPopId', pop.id);
                              form.setValue('naasPopName', label as any);
                              setShowEquinixSearch(false);
                            }}
                          >
                            <span className="font-mono text-xs mr-2">{pop.id}</span>
                            <span>{pop.name || pop.id}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </CommandDialog>
                )}

                {/* Searchable Megaport POP Combobox */}
                {form.watch('naasEnabled') && form.watch('naasProvider') === 'Megaport' && (
                  <CommandDialog open={showMegaportSearch} onOpenChange={setShowMegaportSearch}>
                    <CommandInput placeholder="Type to search Megaport POPs..." />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup heading="Megaport POPs">
                        {(Array.isArray(megaportPOPs) ? (megaportPOPs as any[]) : []).map((pop) => (
                          <CommandItem
                            key={pop.id}
                            value={`${pop.id} ${pop.city || ''} ${pop.country || ''} ${pop.name || ''}`}
                            onSelect={() => {
                              const label = `${pop.name} (${pop.city}, ${pop.country})`;
                              form.setValue('naasPopId', pop.id);
                              form.setValue('naasPopName', label as any);
                              setShowMegaportSearch(false);
                            }}
                          >
                            <span className="font-mono text-xs mr-2">{pop.id}</span>
                            <span>{`${pop.name} (${pop.city}, ${pop.country})`}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </CommandDialog>
                )}
              </div>
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
                  <Label htmlFor="showZLocation">Specify Z Location</Label>
                </div>
                {form.watch('showZLocation') && (
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
                )}
              </div>
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