import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { insertCircuitSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface AddCircuitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const formSchema = insertCircuitSchema.extend({
  monthlyCost: z.string().min(1, "Monthly cost is required"),
  costPerMbps: z.string().min(1, "Cost per Mbps is required"),
  bandwidthMbps: z.coerce.number().min(1, "Bandwidth must be greater than 0"),
});

export default function AddCircuitDialog({ isOpen, onClose, projectId }: AddCircuitDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      circuitId: "",
      projectId,
      siteName: "",
      carrier: "",
      locationType: "Branch",
      serviceType: "",
      circuitCategory: "Internet",
      aLocation: "",
      zLocation: "",
      bandwidth: "",
      bandwidthMbps: 0,
      monthlyCost: "",
      costPerMbps: "",
      contractTerm: null,
      contractEndDate: null,
      status: "active",
      optimizationStatus: "pending",
      notes: null,
    },
  });

  const addCircuitMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await fetch("/api/circuits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        }),
      });
      if (!response.ok) throw new Error("Failed to add circuit");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/circuits"] });
      toast({
        title: "Circuit Added",
        description: "Circuit has been successfully added to inventory.",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add circuit",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: z.infer<typeof formSchema>) => {
    addCircuitMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="add-circuit-description">
        <DialogHeader>
          <DialogTitle>Add New Circuit</DialogTitle>
          <DialogDescription id="add-circuit-description">
            Enter circuit details to add to the inventory
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="circuitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Circuit ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="CKT-001" data-testid="input-circuit-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siteName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Branch Office - New York" data-testid="input-site-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="carrier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Verizon" data-testid="input-carrier" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-location-type">
                          <SelectValue placeholder="Select location type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Branch">Branch</SelectItem>
                        <SelectItem value="Corporate">Corporate</SelectItem>
                        <SelectItem value="Data Center">Data Center</SelectItem>
                        <SelectItem value="Cloud">Cloud</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Internet, MPLS, SD-WAN" data-testid="input-service-type" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="circuitCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Circuit Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-circuit-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Internet">Internet</SelectItem>
                        <SelectItem value="Private">Private</SelectItem>
                        <SelectItem value="Point-to-Point">Point-to-Point</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bandwidth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bandwidth</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="100Mbps" data-testid="input-bandwidth" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bandwidthMbps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bandwidth (Mbps)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="100" data-testid="input-bandwidth-mbps" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthlyCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Cost</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="1500.00" data-testid="input-monthly-cost" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costPerMbps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per Mbps</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="15.00" data-testid="input-cost-per-mbps" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contractTerm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Term</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="36 months" data-testid="input-contract-term" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contractEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract End Date</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date" 
                        value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                        data-testid="input-contract-end-date" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Additional circuit information..." 
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addCircuitMutation.isPending}
                data-testid="button-submit"
              >
                {addCircuitMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Circuit
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}