"use client";

import React from 'react';
import { useUser } from '../../context/UserContext';

/**
 * Renders children only for admins — for hiding a tile, button or section from end users.
 * UI only: anything it hides that calls an API must also be protected by `requireAdmin` there.
 */
const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useUser();
  return isAdmin ? <>{children}</> : null;
};

export default AdminOnly;
