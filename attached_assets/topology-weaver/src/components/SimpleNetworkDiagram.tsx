import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

// Device Types Configuration
const deviceTypes = [
  { id: "router", name: "Router", icon: "🔀", color: "#0078D4" },
  { id: "switch", name: "Switch", icon: "⚡", color: "#107C10" },
  { id: "firewall", name: "Firewall", icon: "🔒", color: "#D83B01" },
  { id: "server", name: "Server", icon: "🖥️", color: "#5C2D91" },
  { id: "client", name: "Client", icon: "💻", color: "#FFB900" },
];

interface Device {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
}

const SimpleNetworkDiagram = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [draggedDevice, setDraggedDevice] = useState<Device | null>(null);

  const addDevice = (deviceTypeId: string) => {
    const deviceType = deviceTypes.find(dt => dt.id === deviceTypeId);
    if (!deviceType) return;

    const newDevice: Device = {
      id: `${deviceTypeId}-${Date.now()}`,
      type: deviceTypeId,
      name: `${deviceType.name} ${devices.filter(d => d.type === deviceTypeId).length + 1}`,
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
    };

    setDevices(prev => [...prev, newDevice]);
  };

  const handleDragStart = (device: Device) => {
    setDraggedDevice(device);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedDevice) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDevices(prev => 
      prev.map(device => 
        device.id === draggedDevice.id 
          ? { ...device, x, y }
          : device
      )
    );
    setDraggedDevice(null);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Toolbox */}
      <div className="w-60 p-4 border-r bg-gray-50 flex flex-col">
        <h2 className="text-lg font-semibold mb-4">Device Toolbox</h2>
        <div className="space-y-3">
          {deviceTypes.map((deviceType) => (
            <Button
              key={deviceType.id}
              variant="outline"
              className="flex items-center p-3 w-full justify-start gap-3"
              onClick={() => addDevice(deviceType.id)}
            >
              <span className="text-xl">{deviceType.icon}</span>
              <span className="text-sm font-medium">{deviceType.name}</span>
            </Button>
          ))}
        </div>

        <div className="mt-6 p-3 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Instructions</h3>
          <p className="text-xs text-blue-700">
            Click on device types above to add them to the diagram. 
            Drag devices around to arrange your network layout.
          </p>
        </div>
      </div>

      {/* Canvas */}
      <div 
        className="flex-1 relative bg-gray-100 overflow-hidden"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Devices */}
        {devices.map((device) => {
          const deviceType = deviceTypes.find(dt => dt.id === device.type);
          return (
            <div
              key={device.id}
              draggable
              onDragStart={() => handleDragStart(device)}
              className="absolute cursor-move bg-white border-2 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow"
              style={{
                left: device.x,
                top: device.y,
                borderColor: deviceType?.color,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">{deviceType?.icon}</span>
                <span className="text-xs font-medium text-gray-700">{device.name}</span>
              </div>
            </div>
          );
        })}

        {devices.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <h3 className="text-lg font-medium mb-2">Empty Network Diagram</h3>
              <p className="text-sm">Click on device types in the toolbox to start building your network</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleNetworkDiagram;