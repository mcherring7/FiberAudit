
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';

interface AddMegaportOnrampDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (onramp: {
    name: string;
    address: string;
    city: string;
    state: string;
    coordinates?: { x: number; y: number };
  }) => void;
}

export default function AddMegaportOnrampDialog({
  open,
  onClose,
  onAdd
}: AddMegaportOnrampDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.address || !formData.city || !formData.state) {
      return;
    }

    // Convert city/state to approximate coordinates (you could use a geocoding service here)
    const coordinates = getApproximateCoordinates(formData.city, formData.state);

    onAdd({
      name: formData.name,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      coordinates
    });

    // Reset form
    setFormData({
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: ''
    });

    onClose();
  };

  const getApproximateCoordinates = (city: string, state: string): { x: number; y: number } => {
    // Basic mapping of major cities to normalized coordinates
    const cityCoords: Record<string, { x: number; y: number }> = {
      'san francisco': { x: 0.08, y: 0.35 },
      'los angeles': { x: 0.15, y: 0.75 },
      'chicago': { x: 0.65, y: 0.35 },
      'new york': { x: 0.85, y: 0.25 },
      'dallas': { x: 0.55, y: 0.75 },
      'atlanta': { x: 0.75, y: 0.65 },
      'seattle': { x: 0.05, y: 0.15 },
      'miami': { x: 0.85, y: 0.95 },
      'denver': { x: 0.45, y: 0.45 },
      'phoenix': { x: 0.25, y: 0.65 }
    };

    const key = city.toLowerCase();
    return cityCoords[key] || { x: 0.5, y: 0.5 };
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-500" />
            Add Megaport Onramp Location
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Location Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Boston Data Center"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="e.g., 100 Summer Street"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="e.g., Boston"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                placeholder="e.g., MA"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zipCode">ZIP Code (Optional)</Label>
            <Input
              id="zipCode"
              value={formData.zipCode}
              onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
              placeholder="e.g., 02101"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
              Add Onramp
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
