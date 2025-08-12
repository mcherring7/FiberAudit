import React from "react";
import { Route } from "wouter";
import OptimizeDemo from "./pages/OptimizeDemo";

export default function App() {
  return (
    <div className="p-4">
      <a href="/optimize" className="underline">Optimize (Flat View)</a>
      <Route path="/optimize" component={OptimizeDemo} />
    </div>
  );
}
