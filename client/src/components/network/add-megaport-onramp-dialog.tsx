
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const onrampFormSchema = z.object({
  name: z.string().min(1, 'Onramp name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().optional(),
  country: z.string().default('United States'),
});

type OnrampFormValues = z.infer<typeof onrampFormSchema>;

interface AddMegaportOnrampDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (onramp: {
    name: string;
    address: string;
    city: string;
    state: string;
    coordinates?: { x: number; y: number };
  }) => void;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

// Common Megaport metro areas for quick selection
const COMMON_MEGAPORT_METROS = [
  { city: 'Atlanta', state: 'Georgia' },
  { city: 'Austin', state: 'Texas' },
  { city: 'Boston', state: 'Massachusetts' },
  { city: 'Charlotte', state: 'North Carolina' },
  { city: 'Denver', state: 'Colorado' },
  { city: 'Detroit', state: 'Michigan' },
  { city: 'Las Vegas', state: 'Nevada' },
  { city: 'Minneapolis', state: 'Minnesota' },
  { city: 'Nashville', state: 'Tennessee' },
  { city: 'Orlando', state: 'Florida' },
  { city: 'Philadelphia', state: 'Pennsylvania' },
  { city: 'Phoenix', state: 'Arizona' },
  { city: 'Pittsburgh', state: 'Pennsylvania' },
  { city: 'Portland', state: 'Oregon' },
  { city: 'Salt Lake City', state: 'Utah' },
  { city: 'San Antonio', state: 'Texas' },
  { city: 'Seattle', state: 'Washington' },
  { city: 'Tampa', state: 'Florida' },
];

export default function AddMegaportOnrampDialog({ open, onClose, onAdd }: AddMegaportOnrampDialogProps) {
  const [useQuickSelect, setUseQuickSelect] = useState(false);
  const { toast } = useToast();

  const form = useForm<OnrampFormValues>({
    resolver: zodResolver(onrampFormSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'United States',
    },
  });

  const handleSubmit = (values: OnrampFormValues) => {
    // Estimate coordinates based on state (rough approximation)
    const stateCoordinates: Record<string, { x: number; y: number }> = {
      'California': { x: 0.12, y: 0.55 },
      'Texas': { x: 0.53, y: 0.78 },
      'Florida': { x: 0.85, y: 0.90 },
      'New York': { x: 0.85, y: 0.25 },
      'Illinois': { x: 0.65, y: 0.35 },
      'Virginia': { x: 0.82, y: 0.40 },
      'Georgia': { x: 0.80, y: 0.65 },
      'Washington': { x: 0.08, y: 0.15 },
      'Oregon': { x: 0.08, y: 0.25 },
      'Colorado': { x: 0.48, y: 0.45 },
      'Arizona': { x: 0.25, y: 0.65 },
      'Nevada': { x: 0.18, y: 0.45 },
      'Utah': { x: 0.35, y: 0.40 },
      'Pennsylvania': { x: 0.80, y: 0.35 },
      'Ohio': { x: 0.75, y: 0.35 },
      'Michigan': { x: 0.70, y: 0.25 },
      'Minnesota': { x: 0.60, y: 0.25 },
      'North Carolina': { x: 0.82, y: 0.50 },
      'Tennessee': { x: 0.70, y: 0.55 },
      'Massachusetts': { x: 0.88, y: 0.20 },
    };

    const coordinates = stateCoordinates[values.state] || { x: 0.5, y: 0.5 };

    onAdd({
      name: values.name || values.city,
      address: values.address,
      city: values.city,
      state: values.state,
      coordinates,
    });

    toast({
      title: 'Success',
      description: `Custom Megaport onramp "${values.city}" has been added.`,
    });

    form.reset();
    onClose();
  };

  const handleQuickSelect = (metro: { city: string; state: string }) => {
    form.setValue('city', metro.city);
    form.setValue('state', metro.state);
    form.setValue('name', metro.city);
    setUseQuickSelect(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Custom Megaport Onramp</DialogTitle>
          <DialogDescription>
            Add a custom Megaport onramp location to extend your network reach.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Select Toggle */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={useQuickSelect ? "default" : "outline"}
              size="sm"
              onClick={() => setUseQuickSelect(!useQuickSelect)}
              data-testid="button-toggle-quick-select"
            >
              {useQuickSelect ? 'Manual Entry' : 'Quick Select Metro'}
            </Button>
          </div>

          {useQuickSelect ? (
            /* Quick Select from Common Metros */
            <div className="space-y-3">
              <Label>Select from Common Megaport Metro Areas:</Label>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {COMMON_MEGAPORT_METROS.map((metro) => (
                  <Button
                    key={`${metro.city}-${metro.state}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSelect(metro)}
                    className="justify-start text-left text-xs"
                    data-testid={`button-select-${metro.city.toLowerCase().replace(' ', '-')}`}
                  >
                    {metro.city}, {metro.state}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            /* Manual Form Entry */
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Onramp Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Atlanta Megaport"
                          {...field}
                          data-testid="input-onramp-name"
                        />
                      </FormControl>
                      <FormDescription>
                        Leave blank to use city name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Atlanta"
                            {...field}
                            data-testid="input-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 Data Center Drive"
                          {...field}
                          data-testid="input-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="30309"
                            {...field}
                            data-testid="input-postal-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled
                            data-testid="input-country"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-add-onramp">
                    Add Onramp
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
