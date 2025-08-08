import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/layout/top-bar";
import CircuitTable from "@/components/inventory/circuit-table";
import ImportDialog from "@/components/inventory/import-dialog";
import AddCircuitDialog from "@/components/inventory/add-circuit-dialog";

export default function Inventory() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleImport = () => {
    setShowImportDialog(true);
  };

  const handleExport = () => {
    // TODO: Implement inventory export
    console.log("Export inventory");
  };

  const handleAddCircuit = () => {
    setShowAddDialog(true);
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
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Circuits
          </h2>
          <Button 
            onClick={handleAddCircuit}
            className="gap-2"
            data-testid="button-add-circuit"
          >
            <Plus className="h-4 w-4" />
            Add Circuit
          </Button>
        </div>
        <CircuitTable />
      </div>

      <ImportDialog 
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        projectId="demo-project-1"
      />

      <AddCircuitDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        projectId="demo-project-1"
      />
    </div>
  );
}
