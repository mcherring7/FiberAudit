import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Database, 
  Flag, 
  FileText, 
  Settings, 
  Network,
  LogOut
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Inventory", href: "/inventory", icon: Database },
  { name: "Audit Flags", href: "/audit-flags", icon: Flag, badge: "3" },
  { name: "Report Builder", href: "/report-builder", icon: FileText },
  { name: "Benchmark Settings", href: "/benchmark-settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-60 bg-white border-r border-neutral-200 flex flex-col">
      {/* Brand Header */}
      <div className="p-6 border-b border-neutral-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Network className="text-white w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-secondary-foreground">Weave</h1>
            <p className="text-xs text-muted-foreground">Telecom Optimization</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <li key={item.name}>
                <Link href={item.href}>
                  <div
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto bg-accent text-white text-xs px-2 py-1 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-neutral-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">JD</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">John Doe</p>
            <p className="text-xs text-muted-foreground">Senior Consultant</p>
          </div>
          <button className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
