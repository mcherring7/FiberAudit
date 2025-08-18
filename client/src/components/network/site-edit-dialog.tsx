import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Site } from "@shared/schema";

interface SiteEditDialogProps {
  site: Site | null;
  open: boolean;
  onClose: () => void;
  onSave: (siteId: string, updates: Partial<Site>) => void;
  onDelete: (siteId: string) => void;
}

export default function SiteEditDialog({ site, open, onClose, onSave, onDelete }: SiteEditDialogProps) {
  const isCreating = !site?.id;
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    category: "",
    description: "",
    streetAddress: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (site) {
      setFormData({
        name: site.name || "",
        location: site.location || "",
        category: site.category || "",
        description: site.description || "",
        streetAddress: site.streetAddress || "",
        city: site.city || "",
        state: site.state || "",
        postalCode: site.postalCode || "",
        country: site.country || "United States",
      });
    } else {
      setFormData({
        name: "",
        location: "",
        category: "",
        description: "",
        streetAddress: "",
        city: "",
        state: "",
        postalCode: "",
        country: "United States",
      });
    }
    setValidationResult(null);
  }, [site]);

  const handleValidateAddress = async () => {
    if (!formData.streetAddress || !formData.city || !formData.state || !formData.postalCode) {
      toast({
        title: "Incomplete Address",
        description: "Please fill in all address fields before validating",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch("/api/addresses/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streetAddress: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
        }),
      });

      if (!response.ok) {
        throw new Error("Validation service unavailable");
      }

      const result = await response.json();
      setValidationResult(result);

      if (result.isValid) {
        toast({
          title: "Address Validated",
          description: "Address validation successful",
        });
      } else {
        toast({
          title: "Validation Issues",
          description: result.message || "Address validation failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Address validation error:", error);
      toast({
        title: "Validation Error",
        description: "Unable to validate address at this time",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Required Fields",
        description: "Site name is required",
        variant: "destructive",
      });
      return;
    }

    const updates = {
      ...formData,
      addressValidated: validationResult?.isValid || false,
      validationProvider: validationResult?.provider || null,
      latitude: validationResult?.coordinates?.latitude || null,
      longitude: validationResult?.coordinates?.longitude || null,
    };

    onSave(site?.id || null, updates);
  };

  const handleDelete = () => {
    if (site && confirm("Are you sure you want to delete this site?")) {
      onDelete(site.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "Create New Site" : "Edit Site"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
              <CardDescription>Core site details and location information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Site Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter site name"
                    data-testid="input-site-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger data-testid="select-site-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Branch">Branch Office</SelectItem>
                      <SelectItem value="Corporate">Corporate HQ</SelectItem>
                      <SelectItem value="Data Center">Data Center</SelectItem>
                      <SelectItem value="Cloud">Cloud Location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Brief location description"
                  data-testid="input-site-location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Additional details about this site"
                  rows={3}
                  data-testid="textarea-site-description"
                />
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Address Information
              </CardTitle>
              <CardDescription>
                Precise address details for proximity analysis and network planning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="streetAddress">Street Address</Label>
                <Input
                  id="streetAddress"
                  value={formData.streetAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, streetAddress: e.target.value }))}
                  placeholder="123 Main Street"
                  data-testid="input-street-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="New York"
                    data-testid="input-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="NY"
                    data-testid="input-state"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="10001"
                    data-testid="input-postal-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select value={formData.country} onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}>
                    <SelectTrigger data-testid="select-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="Mexico">Mexico</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="Germany">Germany</SelectItem>
                      <SelectItem value="France">France</SelectItem>
                      <SelectItem value="Australia">Australia</SelectItem>
                      <SelectItem value="Japan">Japan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <Button
                  onClick={handleValidateAddress}
                  disabled={isValidating || !formData.streetAddress || !formData.city || !formData.state || !formData.postalCode}
                  variant="outline"
                  className="flex items-center"
                  data-testid="button-validate-address"
                >
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Validate Address
                </Button>

                {validationResult && (
                  <Badge variant={validationResult.isValid ? "secondary" : "destructive"}>
                    {validationResult.isValid ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {validationResult.isValid ? "Valid" : "Invalid"}
                  </Badge>
                )}
              </div>

              {validationResult && !validationResult.isValid && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {validationResult.message || "Address validation failed"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Proximity Analysis Results */}
          {site && (site.nearestMegaportPop || site.megaportDistance) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Proximity Analysis</CardTitle>
                <CardDescription>Distance to nearest network access points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {site.nearestMegaportPop && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Nearest Megaport PoP:</span>
                      <span className="text-sm">{site.nearestMegaportPop}</span>
                    </div>
                  )}
                  {site.megaportDistance && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Distance:</span>
                      <span className="text-sm">{site.megaportDistance.toFixed(1)} miles</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex justify-between mt-4 border-t pt-4">
          <div>
            {!isCreating && (
              <Button
                onClick={handleDelete}
                variant="destructive"
                size="sm"
                data-testid="button-delete-site"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Site
              </Button>
            )}
          </div>
          <div className="flex space-x-2">
            <Button onClick={onClose} variant="outline" data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSubmit} data-testid="button-save-site">
              {isCreating ? "Create Site" : "Update Site"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}