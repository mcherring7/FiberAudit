# Overview

Weave is a SaaS application designed to centralize telecom audit and optimization projects for Technologent's internal consulting team. It streamlines the management of telecom inventory data, facilitates auditing workflows, and generates professional client deliverables, addressing inefficiencies associated with scattered spreadsheets and emails.

Key capabilities include:
- Telecom circuit and service inventory management with robust import features.
- Audit tracking with identification of optimization opportunities.
- Exportable client deliverables (dashboards and PDF reports).
- Role-based access control.

The platform supports diverse circuit categories (Internet, Private, Point-to-Point) and location types (Branch, Corporate, Data Center, Cloud). It features an advanced network topology viewer that visualizes enterprise WAN architectures, including SD-WAN integration, private cloud connections (AWS Direct Connect, Azure ExpressRoute), and Megaport NaaS architecture. The topology viewer accurately represents MPLS mesh behavior and supports hub-centric WAN designs. Enhanced site and WAN cloud management capabilities allow for comprehensive editing and design persistence, enabling consultants to customize network representations for client presentations. The application also includes comprehensive circuit editing functionalities that automatically map circuit categories based on service types and recalculate costs. A significant focus is placed on Megaport NaaS integration to showcase hybrid WAN transformation opportunities, supported by a dedicated optimization page with a 4-step assessment tool for financial and technical analysis.

The long-term vision includes API integrations with carrier systems, advanced analytics, and customer portals for real-time access.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built with **React and TypeScript**, utilizing a component-based architecture. **Vite** is used for fast development and optimized production builds. **shadcn/ui** (built on **Radix UI**) provides the UI components, styled with **TailwindCSS** and a custom theming system. **TanStack Query (React Query)** handles server state management, caching, and optimistic updates. **Wouter** is used for client-side routing due to its lightweight nature. The component structure is organized for clear separation of concerns, including dedicated directories for UI primitives, layout, feature-specific components, pages, custom hooks, and utility functions.

## Backend Architecture

The backend uses **Express.js with TypeScript** in an ESM configuration, following a RESTful API design pattern. API routes are organized by domain (projects, circuits, audit flags) and adhere to REST conventions with appropriate HTTP status codes and error handling. A storage abstraction pattern with an `IStorage` interface allows for flexible data access, with `DatabaseStorage` providing the concrete implementation. Custom middleware handles logging and consistent error responses. Development is integrated with Vite for hot module replacement.

## Data Storage Solutions

**PostgreSQL**, managed via **Neon Database** for scalability, serves as the primary database. **Drizzle ORM** provides type-safe database operations, with the schema defined in `/shared/schema.ts` and validated using **Zod**. Key schema entities include `users`, `projects`, `circuits`, and `auditFlags`. Connection pooling via `@neondatabase/serverless` is used for optimal performance.

## Authentication and Authorization

The application supports role-based access control with user roles stored in the database, including consultant and admin roles.

# External Dependencies

- **UI Components**: Radix UI (primitives), Lucide React (icons)
- **Form Handling**: React Hook Form, Hookform Resolvers, Zod (schema validation)
- **Utilities**: class-variance-authority, clsx, date-fns
- **Database**: Neon Database (PostgreSQL hosting), Drizzle ORM
- **Development Tools**: Vite, tsx, esbuild
```