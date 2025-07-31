import TopBar from "@/components/layout/top-bar";
import CircuitTable from "@/components/inventory/circuit-table";

export default function Inventory() {
  const handleImport = () => {
    // TODO: Implement CSV/Excel import
    console.log("Import inventory data");
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
    </div>
  );
}
