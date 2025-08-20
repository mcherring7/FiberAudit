import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface EditCloudAppDialogProps {
  open: boolean;
  onClose: () => void;
  app: any | null;
}

const providerOptions = [
  "AWS",
  "Azure",
  "Google Cloud",
  "Salesforce",
  "ServiceNow",
  "Zoom",
  "Okta",
  "Slack",
  "Box",
  "Dropbox",
  "Atlassian",
  "GitHub",
  "Webex",
  "Zscaler",
  "Cloudflare",
  "Palo Alto",
  "Snowflake",
  "Workday",
  "Zendesk",
  "Datadog",
  "New Relic",
];

const categoryOptions = ["SaaS", "Hyperscaler", "Cloud"];
const statusOptions = ["active", "planned", "retired"];

export default function EditCloudAppDialog({ open, onClose, app }: EditCloudAppDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (app) {
      setForm({
        name: app.name || "",
        provider: app.provider || "",
        category: app.category || "SaaS",
        appType: app.appType || "",
        monthlyCost: app.monthlyCost ?? "0",
        status: app.status || "active",
        notes: app.notes || "",
      });
    }
  }, [app]);

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/cloud-apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update cloud app");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cloud-apps"] });
      onClose();
    },
  });

  const handleSave = () => {
    // Basic normalization: trim strings
    const payload = {
      ...form,
      provider: (form.provider || "").trim(),
      name: (form.name || "").trim(),
      category: (form.category || "SaaS").trim(),
      appType: (form.appType || "").trim(),
      status: (form.status || "active").trim(),
      monthlyCost: String(form.monthlyCost ?? "0"),
    };
    updateMutation.mutate(payload);
  };

  if (!app) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Cloud App</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <Input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Provider</label>
            <input list="provider-list" className="w-full border rounded px-3 py-2 text-sm" value={form.provider} onChange={(e) => setForm((f: any) => ({ ...f, provider: e.target.value }))} />
            <datalist id="provider-list">
              {providerOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Category</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))}>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">App Type</label>
              <Input value={form.appType} onChange={(e) => setForm((f: any) => ({ ...f, appType: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Monthly Cost</label>
              <Input type="number" step="0.01" value={form.monthlyCost} onChange={(e) => setForm((f: any) => ({ ...f, monthlyCost: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Status</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Notes</label>
            <Textarea value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
