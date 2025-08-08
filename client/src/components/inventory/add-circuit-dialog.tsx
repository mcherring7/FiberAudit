import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AddCircuitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export default function AddCircuitDialog({ isOpen, onClose, projectId }: AddCircuitDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-add-circuit">
        <DialogHeader>
          <DialogTitle>Add New Circuit</DialogTitle>
          <DialogDescription>
            Add a new circuit to the inventory
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Circuit creation form will be implemented here.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>
            Add Circuit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}