
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Site, SiteCategory } from "@/types/site";
import { NetworkElement } from "@/types/topology";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ConnectionFormFields from "./ConnectionFormFields";

// Build connection types based on network elements
const getConnectionTypes = () => {
  const baseTypes = ["DIA", "Broadband", "LTE"];
  const types = [...baseTypes];
  
  networkElements.forEach(element => {
    if (element.enabled) {
      switch (element.type) {
        case 'mpls':
          types.push("MPLS");
          break;
        case 'vpls':
          types.push("VPLS");
          break;
        case 'point-to-point':
          types.push("Point-to-Point");
          break;
        case 'aws':
          types.push("AWS Direct Connect");
          break;
        case 'azure':
          types.push("Azure ExpressRoute");
          break;
        case 'gcp':
          types.push("Google Cloud Interconnect");
          break;
        case 'oracle':
          types.push("Oracle FastConnect");
          break;
      }
    }
  });
  
  return [...new Set(types)];
};

const connectionTypes = getConnectionTypes();
const bandwidthOptions = ["10 Mbps", "50 Mbps", "100 Mbps", "500 Mbps", "1 Gbps", "10 Gbps"];
const providerOptions = ["AT&T", "Verizon", "Lumen", "Comcast", "Spectrum", "Zayo"];

// Schema for form validation
const connectionSchema = z.object({
  type: z.string().min(1, "Connection type is required"),
  bandwidth: z.string().min(1, "Bandwidth is required"),
  provider: z.string().optional(),
  remoteEndpoint: z.object({
    siteId: z.string(),
    siteName: z.string(),
  }).optional(),
  circuitId: z.string().optional(),
});

const siteFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().min(1, "Location is required"),
  category: z.enum(["Corporate", "Data Center", "Branch"] as const, {
    required_error: "Category is required",
  }),
  connections: z.array(connectionSchema)
    .min(1, "At least one connection is required")
    .max(3, "Maximum 3 connections allowed"),
});

type SiteFormValues = z.infer<typeof siteFormSchema>;

interface EditSiteDialogProps {
  site: Site | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onUpdateSite: (site: Site) => void;
  siteCategories: SiteCategory[];
  allSites?: Site[];
  networkElements?: NetworkElement[];
}

const EditSiteDialog = ({ 
  site, 
  isOpen, 
  onOpenChange, 
  onUpdateSite,
  siteCategories,
  allSites = [],
  networkElements = []
}: EditSiteDialogProps) => {
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      name: site?.name || "",
      location: site?.location || "",
      category: site?.category || "Corporate",
      connections: site?.connections.map(conn => ({
        type: conn.type,
        bandwidth: conn.bandwidth,
        provider: conn.provider || "none",
        remoteEndpoint: conn.remoteEndpoint,
        circuitId: conn.circuitId
      })) || [
        { type: "DIA", bandwidth: "100 Mbps", provider: "AT&T" }
      ],
    },
  });

  // Update form when site changes
  if (site && isOpen && (form.getValues("name") !== site.name)) {
    form.reset({
      name: site.name,
      location: site.location,
      category: site.category,
      connections: site.connections.map(conn => ({
        type: conn.type,
        bandwidth: conn.bandwidth,
        provider: conn.provider || "none",
        remoteEndpoint: conn.remoteEndpoint,
        circuitId: conn.circuitId
      })),
    });
  }

  const handleSubmit = (values: SiteFormValues, e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (site) {
      const updatedSite: Site = {
        ...site,
        name: values.name,
        location: values.location,
        category: values.category,
        connections: values.connections.map(conn => ({
          type: conn.type,
          bandwidth: conn.bandwidth,
          provider: conn.provider === "none" ? undefined : conn.provider,
          remoteEndpoint: conn.remoteEndpoint,
          circuitId: conn.circuitId
        })),
      };
      
      onUpdateSite(updatedSite);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Site</DialogTitle>
          <DialogDescription>
            Update the details for this site.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit((values) => handleSubmit(values, e))();
            }} 
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select site category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {siteCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <ConnectionFormFields 
              control={form.control}
              name="connections"
              connectionTypes={connectionTypes}
              bandwidthOptions={bandwidthOptions}
              providerOptions={providerOptions}
              allSites={allSites.filter(s => s.id !== site?.id)}
              currentSiteId={site?.id}
            />
            
            {form.formState.errors.connections?.message && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.connections.message}</p>
            )}

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditSiteDialog;
