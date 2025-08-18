import { useState, useMemo } from "react";
import TopBar from "@/components/layout/top-bar";
import CircuitTable from "@/components/inventory/circuit-table";
import ImportDialog from "@/components/inventory/import-dialog";
import AddCircuitDialog from "@/components/inventory/add-circuit-dialog";
import { useQuery } from "@tanstack/react-query";

export default function Inventory() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // Get current project ID from URL
  const currentProjectId = useMemo(() => {
    const pathParts = window.location.pathname.split('/');
    const projectIndex = pathParts.indexOf('projects');
    return projectIndex !== -1 && projectIndex < pathParts.length - 1
      ? pathParts[projectIndex + 1]
      : 'demo-project-1'; // fallback to demo project
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
              Circuit Inventory {project && `- ${project.name}`}
            </h1>
            <p className="text-sm text-gray-600">Manage and analyze your telecom circuits</p>
          </div>
          <div className="flex items-center space-x-3">
            <ImportDialog />
            <AddCircuitDialog />
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <CircuitTable />
      </div>

      <ImportDialog 
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        projectId={currentProjectId}
      />
    </div>
  );
}