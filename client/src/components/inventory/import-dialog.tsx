import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Download,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

interface ImportResult {
  success: number;
  errors: Array<{
    row: number;
    message: string;
    data: any;
  }>;
}

export default function ImportDialog({ isOpen, onClose, projectId }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/circuits/import", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Import failed");
      }
      
      return response.json();
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/circuits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      if (result.success > 0) {
        toast({
          title: "Import Successful",
          description: `Successfully imported ${result.success} circuits.`,
        });
      }
      
      if (result.errors.length > 0) {
        toast({
          title: "Import Warnings",
          description: `${result.errors.length} rows had errors.`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Import Failed", 
        description: "There was an error importing the file.",
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    if (projectId) {
      formData.append("projectId", projectId);
    }
    
    // Simulate upload progress
    setUploadProgress(0);
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);
    
    importMutation.mutate(formData);
  };

  const handleDownloadTemplate = () => {
    // Create CSV template with different circuit types
    const csvContent = `Site Name,Carrier,Location Type,Service Type,Circuit Category,A Location,Z Location,Bandwidth,Bandwidth Mbps,Monthly Cost,Contract Term,Contract End Date,Status,Circuit ID,Notes
Dallas Branch,Comcast,Branch,Broadband,Internet,,100 Mbps,100,299.00,24 months,2025-12-31,active,CIR-PUB-001,Internet broadband service
New York HQ,AT&T,Corporate,Dedicated Internet,Internet,,500 Mbps,500,1250.00,36 months,2025-06-30,active,CIR-PUB-002,Dedicated internet access
Remote Office,Verizon,Branch,LTE,Internet,,50 Mbps,50,150.00,24 months,2025-08-15,active,CIR-PUB-003,LTE cellular backup
Mountain Site,HughesNet,Branch,Satellite,Internet,,25 Mbps,25,199.00,24 months,2025-09-30,active,CIR-PUB-004,Satellite internet for remote location
AWS US-East,Amazon,Cloud,Direct Connect,Private,,500 Mbps,500,950.00,12 months,2025-12-31,active,CIR-CLD-001,AWS Direct Connect
Corporate HQ,AT&T,Corporate,MPLS,Private,,100 Mbps,100,1850.00,36 months,2025-12-31,active,CIR-PRI-001,MPLS private network
Branch Network,Verizon,Branch,VPLS,Private,,200 Mbps,200,2100.00,24 months,2025-07-15,active,CIR-PRI-002,VPLS ethernet service
Primary DC,Lumen,Data Center,Private Line,Point-to-Point,Primary DC,DR Site,1000 Mbps,1000,3500.00,60 months,2026-01-31,active,CIR-P2P-001,Point-to-point fiber between data centers
Main Office,Zayo,Corporate,Dark Fiber,Point-to-Point,Main Office,Backup Site,10000 Mbps,10000,2500.00,120 months,2028-03-15,active,CIR-P2P-002,Dark fiber point-to-point connection`;
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "circuit_import_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetDialog = () => {
    setFile(null);
    setImportResult(null);
    setUploadProgress(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Import Circuits</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <Card className="border-neutral-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">Download Template</h4>
                  <p className="text-sm text-muted-foreground">
                    Get the CSV template with the correct format and example data
                  </p>
                </div>
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File Upload Area */}
          {!importResult && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-neutral-300 hover:border-neutral-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-neutral-100 rounded-full flex items-center justify-center">
                  <FileText className="w-8 h-8 text-neutral-500" />
                </div>
                
                {file ? (
                  <div>
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-foreground">
                      Drop your CSV or Excel file here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Or click to browse files
                    </p>
                  </div>
                )}
                
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  data-testid="input-file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" className="cursor-pointer" asChild>
                    <span>Select File</span>
                  </Button>
                </label>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing import...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="font-medium">Import Complete</span>
              </div>
              
              {importResult.success > 0 && (
                <Alert className="border-success/20 bg-success/5">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <AlertDescription className="text-success">
                    Successfully imported {importResult.success} circuits
                  </AlertDescription>
                </Alert>
              )}
              
              {importResult.errors.length > 0 && (
                <Alert className="border-destructive/20 bg-destructive/5">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <AlertDescription className="text-destructive">
                    {importResult.errors.length} rows had errors:
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {importResult.errors.slice(0, 5).map((error, index) => (
                        <div key={index} className="text-xs">
                          Row {error.row}: {error.message}
                        </div>
                      ))}
                      {importResult.errors.length > 5 && (
                        <div className="text-xs">
                          ...and {importResult.errors.length - 5} more errors
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={resetDialog} data-testid="button-cancel">
              <X className="w-4 h-4 mr-2" />
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && file && (
              <Button 
                onClick={handleImport} 
                disabled={importMutation.isPending}
                data-testid="button-import"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Circuits
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}