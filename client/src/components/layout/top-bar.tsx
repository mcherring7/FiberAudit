import { Button } from "@/components/ui/button";
import { Upload, Download } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onImport?: () => void;
  onExport?: () => void;
}

export default function TopBar({ title, subtitle, onImport, onExport }: TopBarProps) {
  return (
    <header className="bg-white border-b border-neutral-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {onImport && (
            <Button variant="outline" onClick={onImport}>
              <Upload className="w-4 h-4 mr-2" />
              Import Data
            </Button>
          )}
          {onExport && (
            <Button onClick={onExport}>
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
