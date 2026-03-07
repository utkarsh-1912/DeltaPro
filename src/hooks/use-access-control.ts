"use client";

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRotaStore } from '@/lib/store';

export function useAccessControl() {
  const { data: session } = useSession();
  const { teams } = useRotaStore();

  const role = session?.user?.role?.toLowerCase() || 'user';
  const userId = session?.user?.id;

  // Role checks
  const canAccessAdmin = useMemo(() => {
    return role === 'admin' || role === 'hr' || role === 'pm';
  }, [role]);

  const accessibleTeams = useMemo(() => {
    // Admins and HR can see all teams.
    if (role === 'admin' || role === 'hr') {
      return teams;
    }
    // PMs can only see the teams they are assigned to.
    if (role === 'pm' && userId) {
      return teams.filter(team => team.pmId === userId);
    }
    // Users and others see no teams by default.
    return [];
  }, [role, teams, userId]);

  return { role, canAccessAdmin, accessibleTeams };
}
