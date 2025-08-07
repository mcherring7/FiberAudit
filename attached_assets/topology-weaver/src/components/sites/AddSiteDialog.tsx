
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Site, SiteCategory } from "@/types/site";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from "sonner";
import ConnectionFormFields from "./ConnectionFormFields";

// Constants
const connectionTypes = ["DIA", "MPLS", "Direct Connect", "Broadband", "LTE"];
const bandwidthOptions = ["10 Mbps", "50 Mbps", "100 Mbps", "500 Mbps", "1 Gbps", "10 Gbps"];
const providerOptions = ["AT&T", "Verizon", "Lumen", "Comcast", "Spectrum", "Zayo"];

// Schema for form validation
const connectionSchema = z.object({
  type: z.string().min(1, "Connection type is required"),
  bandwidth: z.string().min(1, "Bandwidth is required"),
  provider: z.string().optional(),
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

interface AddSiteDialogProps {
  onAddSite: (site: Site) => void;
  siteCategories: SiteCategory[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const AddSiteDialog = ({ onAddSite, siteCategories, isOpen, onOpenChange }: AddSiteDialogProps) => {
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      name: "",
      location: "",
      category: "Corporate",
      connections: [
        { type: "DIA", bandwidth: "100 Mbps", provider: "AT&T" }
      ],
    },
  });

  const handleSubmit = (values: SiteFormValues) => {
    const newSite: Site = {
      id: "",
      name: values.name,
      location: values.location,
      category: values.category,
      connections: values.connections.map(conn => ({
        type: conn.type,
        bandwidth: conn.bandwidth,
        provider: conn.provider
      })),
      coordinates: { x: 0, y: 0 },
    };
    
    onAddSite(newSite);
    toast.success("Site added successfully");
    onOpenChange(false);
    form.reset({
      name: "",
      location: "",
      category: "Corporate",
      connections: [
        { type: "DIA", bandwidth: "100 Mbps", provider: "AT&T" }
      ],
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="text-xs">
          Add Site
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Site</DialogTitle>
          <DialogDescription>
            Enter the details for the new site.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Headquarters" {...field} />
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
                    <Input placeholder="New York" {...field} />
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
            />
            
            {form.formState.errors.connections?.message && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.connections.message}</p>
            )}

            <DialogFooter>
              <Button type="submit">Add Site</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSiteDialog;
