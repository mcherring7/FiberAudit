import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Database, 
  Flag, 
  FileText, 
  Settings, 
  Network,
  LogOut,
  Share2
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Inventory", href: "/inventory", icon: Database },
  { name: "Network Topology", href: "/network-topology", icon: Share2 },
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
          <div className="w-8 h-8 flex items-center justify-center">
            <svg 
              width="32" 
              height="32" 
              viewBox="0 0 100 100" 
              className="w-8 h-8"
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Hexagonal background with gradient */}
              <defs>
                <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#1E40AF" />
                </linearGradient>
                <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#EA580C" />
                </linearGradient>
              </defs>
              
              {/* Hexagon shape - more defined */}
              <path 
                d="M50 8 L78 22 L78 58 L50 72 L22 58 L22 22 Z" 
                fill="url(#hexGrad)" 
                stroke="#1E40AF" 
                strokeWidth="2"
              />
              {/* Inner hexagon for depth */}
              <path 
                d="M50 15 L70 27 L70 53 L50 65 L30 53 L30 27 Z" 
                fill="none" 
                stroke="#60A5FA" 
                strokeWidth="1" 
                opacity="0.5"
              />
              
              {/* Simple, clear infinity symbol */}
              <g transform="translate(50,40) scale(0.8)">
                {/* Left loop */}
                <circle cx="-8" cy="0" r="6" fill="none" stroke="url(#orangeGrad)" strokeWidth="3" />
                {/* Right loop */}
                <circle cx="8" cy="0" r="6" fill="none" stroke="url(#orangeGrad)" strokeWidth="3" />
                {/* Center connection */}
                <path d="M-2 0 L2 0" stroke="url(#orangeGrad)" strokeWidth="3" strokeLinecap="round" />
                {/* Fill circles with gradient */}
                <circle cx="-8" cy="0" r="4" fill="url(#orangeGrad)" opacity="0.8" />
                <circle cx="8" cy="0" r="4" fill="url(#orangeGrad)" opacity="0.8" />
              </g>
            </svg>
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
