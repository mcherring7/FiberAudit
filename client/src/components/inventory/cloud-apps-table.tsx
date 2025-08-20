import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import EditCloudAppDialog from "./edit-cloud-app-dialog";

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

export default function CloudAppsTable() {
  const projectId = useCurrentProjectId();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['/api/cloud-apps', projectId],
    queryFn: async () => {
      if (!projectId) return [] as any[];
      const res = await fetch(`/api/cloud-apps?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to load cloud apps');
      return res.json();
    },
    enabled: !!projectId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cloud-apps/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete cloud app');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/cloud-apps'] });
    }
  });

  if (!projectId) {
    return <div className="text-sm text-gray-600">Select a project to view Cloud Apps.</div>;
  }

  if (isLoading) {
    return <div className="text-sm text-gray-600">Loading Cloud Apps…</div>;
  }

  return (
    <div className="bg-white rounded-md border">
      <div className="px-4 py-3 border-b">
        <h2 className="font-medium">Cloud Applications</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Provider</th>
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-right px-4 py-2">Monthly Cost</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No cloud apps yet.</td>
              </tr>
            )}
            {apps.map((a: any) => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2">{a.provider || '-'}</td>
                <td className="px-4 py-2">{a.category}</td>
                <td className="px-4 py-2 text-right">${Number(a.monthlyCost ?? 0).toLocaleString()}</td>
                <td className="px-4 py-2">{a.status}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedApp(a); setEditOpen(true); }}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(a.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EditCloudAppDialog open={editOpen} onClose={() => { setEditOpen(false); setSelectedApp(null); }} app={selectedApp} />
    </div>
  );
}
