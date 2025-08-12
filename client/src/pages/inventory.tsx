import { useState } from "react";
import TopBar from "@/components/layout/top-bar";
import CircuitTable from "@/components/inventory/circuit-table";
import ImportDialog from "@/components/inventory/import-dialog";
import AddCircuitDialog from "@/components/inventory/add-circuit-dialog";

export default function Inventory() {
  const [showImportDialog, setShowImportDialog] = useState(false);

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
            <h1 className="text-2xl font-semibold text-gray-900">Circuit Inventory</h1>
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
        projectId="project-1"
      />
    </div>
  );
}