
"use client";

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useRotaStore } from '@/lib/store';

export function useAccessControl() {
  const { profile } = useAuthStore();
  const { teams } = useRotaStore();

  const role = profile?.role || 'user';
  
  // This logic is now corrected and simplified.
  // It directly checks the role to determine access to the admin page.
  const canAccessAdmin = useMemo(() => {
    return role === 'admin' || role === 'hr' || role === 'pm';
  }, [role]);

  const accessibleTeams = useMemo(() => {
    // Admins and HR can see all teams.
    if (role === 'admin' || role === 'hr') {
      return teams;
    }
    // PMs can only see the teams they are assigned to.
    if (role === 'pm' && profile?.id) {
       return teams.filter(team => team.pmId === profile.id);
    }
    // Users and others see no teams by default.
    return [];
  }, [role, teams, profile?.id]);

  return { role, canAccessAdmin, accessibleTeams };
}
