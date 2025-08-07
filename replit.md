# Overview

Weave is a SaaS application designed to streamline telecom audit and optimization projects for Technologent's internal consulting team. The application centralizes telecom inventory data, facilitates auditing workflows, and generates professional client deliverables. It addresses the inefficiencies of managing circuit inventories, billing records, and optimization recommendations across scattered spreadsheets and emails by providing a unified platform for telecom consultants and solution architects.

The core functionality includes telecom circuit and service inventory management with comprehensive import capabilities, audit tracking with opportunity identification, exportable client deliverables (dashboards and PDF reports), and role-based access control. The platform supports three circuit categories: Internet (broadband, dedicated, LTE, satellite), Private (MPLS/VPLS), and Point-to-Point (private line with A/Z locations). Location types are categorized as Branch, Corporate, Data Center, and Cloud. Future scope includes API integrations with carrier systems, analytics and benchmarking modules, and customer portals with real-time access.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built using **React with TypeScript** and follows a component-based architecture with modern React patterns. The application uses **Vite** as the build tool for fast development and optimized production builds.

**UI Framework**: The application leverages **shadcn/ui** components built on top of **Radix UI primitives** for accessibility and consistency. **TailwindCSS** provides utility-first styling with a custom design system featuring CSS variables for theming.

**State Management**: **TanStack Query (React Query)** handles server state management, caching, and data synchronization. The application uses a custom query client configuration with automatic error handling and optimistic updates for better user experience.

**Routing**: **Wouter** provides lightweight client-side routing, chosen for its minimal bundle size and simple API compared to React Router.

**Component Structure**: The frontend follows a well-organized directory structure with separation of concerns:
- `/components/ui` - Reusable UI primitives
- `/components/layout` - Layout-specific components (sidebar, top bar)
- `/components/dashboard` - Dashboard-specific components
- `/components/inventory` - Inventory management components
- `/pages` - Route-level page components
- `/hooks` - Custom React hooks
- `/lib` - Utility functions and configurations

## Backend Architecture

The backend uses **Express.js** with **TypeScript** in an ESM (ES Modules) configuration. The server follows a RESTful API design pattern with structured route handling and middleware.

**API Structure**: Routes are organized in `/server/routes.ts` with endpoints for projects, circuits, and audit flags. The API follows REST conventions with proper HTTP status codes and error handling.

**Storage Layer**: The application implements a storage abstraction pattern with an `IStorage` interface, allowing for flexible data access patterns. The `DatabaseStorage` class provides concrete implementations for all data operations.

**Middleware**: Custom logging middleware tracks API performance and response times. Error handling middleware provides consistent error responses across all endpoints.

**Development Tools**: The server integrates with Vite in development mode for hot module replacement and seamless full-stack development experience.

## Data Storage Solutions

**Database**: **PostgreSQL** serves as the primary database, accessed through **Neon Database** serverless infrastructure for scalability and managed hosting.

**ORM**: **Drizzle ORM** provides type-safe database operations with excellent TypeScript integration. The schema is defined in `/shared/schema.ts` with automatic type generation and validation using **Zod**.

**Database Schema**: The schema includes core entities:
- `users` - User authentication and roles
- `projects` - Project management and client information
- `circuits` - Telecom circuit inventory with comprehensive metadata
- `auditFlags` - Audit findings and optimization opportunities

**Connection Management**: Uses connection pooling through `@neondatabase/serverless` with WebSocket support for optimal performance.

## Authentication and Authorization

The application implements a role-based access control system with user roles stored in the database. The current implementation includes basic user management with support for consultant and admin roles, though full authentication middleware is not yet implemented in the provided codebase.

## External Dependencies

**UI Components**: Extensive use of **Radix UI** primitives ensures accessibility compliance and consistent behavior across components. **Lucide React** provides a comprehensive icon library.

**Form Handling**: **React Hook Form** with **Hookform Resolvers** manages form state and validation, integrated with Zod schemas for type-safe form validation.

**Utilities**: **class-variance-authority** and **clsx** handle conditional CSS classes and component variants. **date-fns** provides date manipulation utilities.

**Development**: **tsx** enables direct TypeScript execution in development, while **esbuild** handles production builds for optimal performance.

The architecture prioritizes type safety, developer experience, and scalability while maintaining a clean separation of concerns between frontend and backend systems.