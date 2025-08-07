import { useFieldArray, Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { PlusCircle, X } from "lucide-react";
import { FormLabel } from "@/components/ui/form";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { toast } from "sonner";
import { Site } from "@/types/site";

// Connection schema for form validation
const connectionSchema = z.object({
  type: z.string().min(1, "Connection type is required"),
  bandwidth: z.string().min(1, "Bandwidth is required"),
  provider: z.string().optional(),
});

export type ConnectionFormValues = z.infer<typeof connectionSchema>;

interface ConnectionFormFieldsProps {
  control: Control<any>;
  name: string;
  connectionTypes: string[];
  bandwidthOptions: string[];
  providerOptions: string[];
  allSites?: Site[];
  currentSiteId?: string;
}

import { useProviders } from "@/contexts/ProviderContext";

const ConnectionFormFields = ({
  control,
  name,
  connectionTypes,
  bandwidthOptions,
  providerOptions,
  allSites = [],
  currentSiteId
}: ConnectionFormFieldsProps) => {
  const { getAvailableProviders } = useProviders();
  const availableProviders = providerOptions || getAvailableProviders();
  const connectionsField = useFieldArray({
    control,
    name,
  });

  const addConnection = () => {
    if (connectionsField.fields.length < 3) {
      connectionsField.append({ type: "DIA", bandwidth: "100 Mbps", provider: "AT&T" });
    } else {
      toast.error("Maximum 3 connections allowed");
    }
  };

  const removeConnection = (index: number) => {
    if (connectionsField.fields.length > 1) {
      connectionsField.remove(index);
    } else {
      toast.error("At least one connection is required");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <FormLabel>Connections ({connectionsField.fields.length}/3)</FormLabel>
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          onClick={addConnection}
          disabled={connectionsField.fields.length >= 3}
        >
          <PlusCircle className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {connectionsField.fields.map((field, index) => {
        const connection = connectionsField.fields[index];
        return (
        <div key={field.id} className="flex flex-col gap-2 mb-3 p-2 border rounded-md">
          <div className="flex items-end gap-2">
            <FormField
              control={control}
              name={`${name}.${index}.type`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="text-xs">Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select connection type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {connectionTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${name}.${index}.bandwidth`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="text-xs">Bandwidth</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bandwidth" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {bandwidthOptions.map((bandwidth) => (
                        <SelectItem key={bandwidth} value={bandwidth}>
                          {bandwidth}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              onClick={() => removeConnection(index)}
              disabled={connectionsField.fields.length <= 1}
              className="h-8 w-8 p-0 mt-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <FormField
            control={control}
            name={`${name}.${index}.provider`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="text-xs">Provider</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {availableProviders.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Point-to-Point specific fields */}
          {connection?.type === "Point-to-Point" && (
            <>
              <FormField
                control={control}
                name={`${name}.${index}.remoteEndpoint.siteId`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="text-xs">Remote Site</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        const remoteSite = allSites.find(s => s.id === value);
                        field.onChange(value);
                        // Also update the site name
                        if (remoteSite) {
                          const remoteEndpointField = control._getWatch(`${name}.${index}.remoteEndpoint.siteName`);
                          control._formValues[name][index].remoteEndpoint = {
                            siteId: value,
                            siteName: remoteSite.name
                          };
                        }
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select remote site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allSites.filter(site => site.id !== currentSiteId).map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name} ({site.location})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`${name}.${index}.circuitId`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="text-xs">Circuit ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter circuit identifier" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </div>
      )})}
    </div>
  );
};

export default ConnectionFormFields;