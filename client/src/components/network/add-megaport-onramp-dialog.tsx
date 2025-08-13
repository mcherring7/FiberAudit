
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Search } from 'lucide-react';

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

// Comprehensive Megaport public locations database
const MEGAPORT_LOCATIONS = [
  { name: 'Boston', city: 'Boston', state: 'MA', address: '1 Summer Street, Boston, MA 02110', x: 0.88, y: 0.32 },
  { name: 'Washington DC', city: 'Washington', state: 'DC', address: '1100 New York Avenue NW, Washington, DC 20005', x: 0.82, y: 0.42 },
  { name: 'Philadelphia', city: 'Philadelphia', state: 'PA', address: '401 North Broad Street, Philadelphia, PA 19108', x: 0.84, y: 0.38 },
  { name: 'Charlotte', city: 'Charlotte', state: 'NC', address: '530 South Tryon Street, Charlotte, NC 28202', x: 0.78, y: 0.55 },
  { name: 'Jacksonville', city: 'Jacksonville', state: 'FL', address: '76 South Laura Street, Jacksonville, FL 32202', x: 0.82, y: 0.75 },
  { name: 'Tampa', city: 'Tampa', state: 'FL', address: '100 North Tampa Street, Tampa, FL 33602', x: 0.80, y: 0.85 },
  { name: 'Nashville', city: 'Nashville', state: 'TN', address: '333 Commerce Street, Nashville, TN 37201', x: 0.70, y: 0.55 },
  { name: 'Louisville', city: 'Louisville', state: 'KY', address: '400 West Market Street, Louisville, KY 40202', x: 0.72, y: 0.48 },
  { name: 'Cincinnati', city: 'Cincinnati', state: 'OH', address: '312 Walnut Street, Cincinnati, OH 45202', x: 0.75, y: 0.45 },
  { name: 'Columbus', city: 'Columbus', state: 'OH', address: '88 East Broad Street, Columbus, OH 43215', x: 0.77, y: 0.42 },
  { name: 'Cleveland', city: 'Cleveland', state: 'OH', address: '1360 East 9th Street, Cleveland, OH 44114', x: 0.78, y: 0.38 },
  { name: 'Pittsburgh', city: 'Pittsburgh', state: 'PA', address: '1 Oxford Centre, Pittsburgh, PA 15219', x: 0.76, y: 0.40 },
  { name: 'Buffalo', city: 'Buffalo', state: 'NY', address: '200 Delaware Avenue, Buffalo, NY 14202', x: 0.81, y: 0.32 },
  { name: 'Detroit', city: 'Detroit', state: 'MI', address: '150 West Jefferson Avenue, Detroit, MI 48226', x: 0.75, y: 0.35 },
  { name: 'Milwaukee', city: 'Milwaukee', state: 'WI', address: '111 East Wisconsin Avenue, Milwaukee, WI 53202', x: 0.68, y: 0.32 },
  { name: 'Minneapolis', city: 'Minneapolis', state: 'MN', address: '80 South 8th Street, Minneapolis, MN 55402', x: 0.62, y: 0.28 },
  { name: 'Kansas City', city: 'Kansas City', state: 'MO', address: '1100 Main Street, Kansas City, MO 64105', x: 0.60, y: 0.50 },
  { name: 'St. Louis', city: 'St. Louis', state: 'MO', address: '100 North 4th Street, St. Louis, MO 63102', x: 0.65, y: 0.52 },
  { name: 'Indianapolis', city: 'Indianapolis', state: 'IN', address: '1 Monument Circle, Indianapolis, IN 46204', x: 0.72, y: 0.45 },
  { name: 'Oklahoma City', city: 'Oklahoma City', state: 'OK', address: '100 North Broadway, Oklahoma City, OK 73102', x: 0.58, y: 0.62 },
  { name: 'Austin', city: 'Austin', state: 'TX', address: '98 San Jacinto Boulevard, Austin, TX 78701', x: 0.52, y: 0.78 },
  { name: 'San Antonio', city: 'San Antonio', state: 'TX', address: '100 East Houston Street, San Antonio, TX 78205', x: 0.50, y: 0.82 },
  { name: 'El Paso', city: 'El Paso', state: 'TX', address: '2 Civic Center Plaza, El Paso, TX 79901', x: 0.42, y: 0.78 },
  { name: 'Albuquerque', city: 'Albuquerque', state: 'NM', address: '400 Marquette Avenue NW, Albuquerque, NM 87102', x: 0.40, y: 0.65 },
  { name: 'Denver', city: 'Denver', state: 'CO', address: '1670 Broadway, Denver, CO 80202', x: 0.45, y: 0.48 },
  { name: 'Salt Lake City', city: 'Salt Lake City', state: 'UT', address: '36 South State Street, Salt Lake City, UT 84111', x: 0.35, y: 0.42 },
  { name: 'Las Vegas', city: 'Las Vegas', state: 'NV', address: '300 Las Vegas Boulevard South, Las Vegas, NV 89101', x: 0.28, y: 0.62 },
  { name: 'Phoenix', city: 'Phoenix', state: 'AZ', address: '2 North Central Avenue, Phoenix, AZ 85004', x: 0.32, y: 0.68 },
  { name: 'Tucson', city: 'Tucson', state: 'AZ', address: '88 East Broadway Boulevard, Tucson, AZ 85701', x: 0.35, y: 0.72 },
  { name: 'Sacramento', city: 'Sacramento', state: 'CA', address: '915 L Street, Sacramento, CA 95814', x: 0.18, y: 0.48 },
  { name: 'San Jose', city: 'San Jose', state: 'CA', address: '200 East Santa Clara Street, San Jose, CA 95113', x: 0.15, y: 0.52 },
  { name: 'Oakland', city: 'Oakland', state: 'CA', address: '1 Frank H. Ogawa Plaza, Oakland, CA 94612', x: 0.12, y: 0.48 },
  { name: 'San Diego', city: 'San Diego', state: 'CA', address: '202 C Street, San Diego, CA 92101', x: 0.22, y: 0.88 },
  { name: 'Fresno', city: 'Fresno', state: 'CA', address: '2600 Fresno Street, Fresno, CA 93721', x: 0.20, y: 0.62 },
  { name: 'Portland', city: 'Portland', state: 'OR', address: '1120 NW Couch Street, Portland, OR 97209', x: 0.12, y: 0.28 },
  { name: 'Eugene', city: 'Eugene', state: 'OR', address: '777 Pearl Street, Eugene, OR 97401', x: 0.14, y: 0.32 },
  { name: 'Spokane', city: 'Spokane', state: 'WA', address: '808 West Spokane Falls Boulevard, Spokane, WA 99201', x: 0.18, y: 0.22 },
  { name: 'Boise', city: 'Boise', state: 'ID', address: '150 North Capitol Boulevard, Boise, ID 83702', x: 0.25, y: 0.32 },
  { name: 'Billings', city: 'Billings', state: 'MT', address: '2815 2nd Avenue North, Billings, MT 59101', x: 0.42, y: 0.25 },
  { name: 'Fargo', city: 'Fargo', state: 'ND', address: '225 4th Street North, Fargo, ND 58102', x: 0.55, y: 0.22 },
  { name: 'Sioux Falls', city: 'Sioux Falls', state: 'SD', address: '224 West 9th Street, Sioux Falls, SD 57104', x: 0.58, y: 0.32 },
  { name: 'Omaha', city: 'Omaha', state: 'NE', address: '1819 Farnam Street, Omaha, NE 68183', x: 0.58, y: 0.42 },
  { name: 'Des Moines', city: 'Des Moines', state: 'IA', address: '400 Robert D. Ray Drive, Des Moines, IA 50309', x: 0.62, y: 0.42 },
  { name: 'Little Rock', city: 'Little Rock', state: 'AR', address: '500 West Markham Street, Little Rock, AR 72201', x: 0.62, y: 0.65 },
  { name: 'New Orleans', city: 'New Orleans', state: 'LA', address: '1300 Perdido Street, New Orleans, LA 70112', x: 0.65, y: 0.82 },
  { name: 'Baton Rouge', city: 'Baton Rouge', state: 'LA', address: '222 St. Louis Street, Baton Rouge, LA 70802', x: 0.63, y: 0.78 },
  { name: 'Shreveport', city: 'Shreveport', state: 'LA', address: '505 Travis Street, Shreveport, LA 71101', x: 0.60, y: 0.72 },
  { name: 'Jackson', city: 'Jackson', state: 'MS', address: '100 South State Street, Jackson, MS 39201', x: 0.65, y: 0.72 },
  { name: 'Birmingham', city: 'Birmingham', state: 'AL', address: '710 North 20th Street, Birmingham, AL 35203', x: 0.72, y: 0.68 },
  { name: 'Mobile', city: 'Mobile', state: 'AL', address: '205 Government Street, Mobile, AL 36602', x: 0.68, y: 0.78 },
  { name: 'Montgomery', city: 'Montgomery', state: 'AL', address: '103 South Perry Street, Montgomery, AL 36104', x: 0.72, y: 0.72 }
];

export default function AddMegaportOnrampDialog({
  open,
  onClose,
  onAdd
}: AddMegaportOnrampDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<typeof MEGAPORT_LOCATIONS[0] | null>(null);

  const filteredLocations = MEGAPORT_LOCATIONS.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    if (!selectedLocation) return;

    onAdd({
      name: selectedLocation.name,
      address: selectedLocation.address,
      city: selectedLocation.city,
      state: selectedLocation.state,
      coordinates: { x: selectedLocation.x, y: selectedLocation.y }
    });

    setSelectedLocation(null);
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-500" />
            Add Megaport Location
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Select from Megaport's publicly available data center locations
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by city or state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Location List */}
          <div className="max-h-80 overflow-y-auto border rounded-lg">
            {filteredLocations.map((location, index) => (
              <div
                key={index}
                className={`p-3 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 ${
                  selectedLocation?.name === location.name ? 'bg-orange-50 border-orange-200' : ''
                }`}
                onClick={() => setSelectedLocation(location)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {location.name}, {location.state}
                    </div>
                    <div className="text-sm text-gray-600">
                      {location.address}
                    </div>
                  </div>
                  {selectedLocation?.name === location.name && (
                    <div className="text-orange-500">
                      <MapPin className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredLocations.length === 0 && searchTerm && (
            <div className="text-center py-8 text-gray-500">
              No locations found matching "{searchTerm}"
            </div>
          )}

          {/* Selected Location Preview */}
          {selectedLocation && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="text-sm font-medium text-orange-900">Selected Location:</div>
              <div className="text-sm text-orange-800">
                {selectedLocation.name}, {selectedLocation.state}
              </div>
              <div className="text-xs text-orange-700">
                {selectedLocation.address}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleAdd}
              disabled={!selectedLocation}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
            >
              Add Location
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
