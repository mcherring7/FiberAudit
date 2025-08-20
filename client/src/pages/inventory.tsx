import { useState, useMemo } from "react";
import TopBar from "@/components/layout/top-bar";
import CircuitTable from "@/components/inventory/circuit-table";
import ImportDialog from "@/components/inventory/import-dialog";
import AddCircuitDialog from "@/components/inventory/add-circuit-dialog";
import CloudAppsTable from "@/components/inventory/cloud-apps-table";
import AddCloudAppDialog from "@/components/inventory/add-cloud-app-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export default function Inventory() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'circuits' | 'cloud-apps'>('circuits');
  const [showAddCircuitDialog, setShowAddCircuitDialog] = useState(false);
  const [showAddCloudAppDialog, setShowAddCloudAppDialog] = useState(false);
  
  // Get current project ID from URL (no demo fallback)
  const currentProjectId = useMemo(() => {
    const pathParts = window.location.pathname.split('/');
    const projectIndex = pathParts.indexOf('projects');
    if (projectIndex !== -1 && projectIndex < pathParts.length - 1) {
      return pathParts[projectIndex + 1];
    }
    return '';
  }, []);

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ['/api/projects', currentProjectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${currentProjectId}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    },
    enabled: !!currentProjectId,
  });

  const handleImport = () => {
    setShowImportDialog(true);
  };

  const handleExport = () => {
    // TODO: Implement inventory export
    console.log("Export inventory");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Inventory {project && `- ${project.name}`}
            </h1>
            <p className="text-sm text-gray-600">Manage circuits and cloud applications</p>
          </div>
          <div className="flex items-center space-x-3">
            {activeTab === 'circuits' ? (
              <>
                <Button variant="outline" onClick={() => setShowImportDialog(true)}>Import</Button>
                <Button onClick={() => setShowAddCircuitDialog(true)}>Add Circuit</Button>
              </>
            ) : (
              <Button onClick={() => setShowAddCloudAppDialog(true)}>Add Cloud App</Button>
            )}
          </div>
        </div>
        <div className="mt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="circuits">Circuits</TabsTrigger>
              <TabsTrigger value="cloud-apps">Cloud Apps</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsContent value="circuits">
            <CircuitTable />
          </TabsContent>
          <TabsContent value="cloud-apps">
            <CloudAppsTable />
          </TabsContent>
        </Tabs>
      </div>

      <ImportDialog 
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        projectId={currentProjectId}
      />
      <AddCircuitDialog 
        open={showAddCircuitDialog}
        onClose={() => setShowAddCircuitDialog(false)}
      />
      <AddCloudAppDialog 
        open={showAddCloudAppDialog}
        onClose={() => setShowAddCloudAppDialog(false)}
      />
    </div>
  );
}