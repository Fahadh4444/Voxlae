"use client";

import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

/** Navbar + Footer chrome for the public pages. Lifted from the old `App.tsx`. */
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="vx-app-layout">
    <Navbar />
    <main className="vx-main">{children}</main>
    <Footer />
  </div>
);

export default MainLayout;
