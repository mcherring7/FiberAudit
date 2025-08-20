import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const addCloudAppSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  provider: z.string().optional(),
  category: z.enum(['SaaS', 'Hyperscaler', 'Cloud']).default('SaaS'),
  appType: z.string().optional(),
  monthlyCost: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().optional(),
});

type AddCloudAppForm = z.infer<typeof addCloudAppSchema>;

function useCurrentProjectId(): string {
  return useMemo(() => {
    const fromStorage = localStorage.getItem('currentProjectId');
    if (fromStorage) return fromStorage;
    const parts = window.location.pathname.split('/');
    const idx = parts.indexOf('projects');
    if (idx !== -1 && idx < parts.length - 1) return parts[idx + 1];
    return '';
  }, []);
}

export default function AddCloudAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);
  const [providerMode, setProviderMode] = useState<'preset' | 'other'>('preset');

  const form = useForm<AddCloudAppForm>({
    resolver: zodResolver(addCloudAppSchema),
    defaultValues: {
      name: '',
      provider: '',
      category: 'SaaS',
      appType: '',
      monthlyCost: '',
      status: 'active',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AddCloudAppForm) => {
      if (!projectId) throw new Error('No project selected');
      const res = await fetch('/api/cloud-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          projectId,
          // Server expects decimal fields as strings per drizzle-zod schema
          monthlyCost: data.monthlyCost && data.monthlyCost !== '' ? data.monthlyCost : '0',
        }),
      });
      if (!res.ok) {
        let msg = 'Failed to create cloud app';
        try {
          const j = await res.json();
          if (j?.message) msg = j.message;
        } catch {}
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => {
      setApiError(null);
      queryClient.invalidateQueries({ queryKey: ['/api/cloud-apps'] });
      form.reset();
      onClose();
    },
    onError: (err: any) => {
      setApiError(err?.message || 'Request failed');
    }
  });

  const onSubmit = (data: AddCloudAppForm) => createMutation.mutate(data);

  const providerPresetsByCategory: Record<string, string[]> = {
    SaaS: ['Microsoft', 'Google', 'Salesforce', 'Zoom', 'ServiceNow', 'Atlassian'],
    Hyperscaler: ['AWS', 'Azure', 'Google Cloud'],
    Cloud: ['AWS', 'Cloudflare', 'Akamai', 'Oracle Cloud', 'IBM Cloud'],
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Cloud App</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {apiError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {apiError}
              </div>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Microsoft 365" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    {providerMode === 'preset' ? (
                      <>
                        <Select onValueChange={(v) => { if (v === 'other') { setProviderMode('other'); field.onChange(''); } else { field.onChange(v); } }} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(providerPresetsByCategory[form.watch('category')] || []).map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                            <SelectItem value="other">Other…</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <FormControl>
                        <Input {...field} placeholder="Enter provider" onBlur={() => { if (!field.value) setProviderMode('preset'); }} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SaaS">SaaS</SelectItem>
                        <SelectItem value="Hyperscaler">Hyperscaler</SelectItem>
                        <SelectItem value="Cloud">Cloud</SelectItem>
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
                name="appType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select app type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['UCaaS','CCaaS','CRM','ERP','ITSM','Security','CDN','IaaS','PaaS','DaaS','SASE'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add Cloud App'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
