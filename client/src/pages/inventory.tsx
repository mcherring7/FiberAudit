import { useState } from "react";
import TopBar from "@/components/layout/top-bar";
import CircuitTable from "@/components/inventory/circuit-table";
import ImportDialog from "@/components/inventory/import-dialog";

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
    <div className="h-full flex flex-col">
      <TopBar
        title="Circuit Inventory"
        subtitle="Manage and analyze telecom circuit data"
        onImport={handleImport}
        onExport={handleExport}
      />
      
      <div className="flex-1 p-6 overflow-y-auto">
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
