
"use client";

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useRotaStore } from '@/lib/store';

export function useAccessControl() {
  const { profile } = useAuthStore();
  const { teams } = useRotaStore();

  const role = profile?.role || 'user';
  
  const canAccessAdmin = useMemo(() => {
    return role === 'admin' || role === 'hr' || role === 'pm';
  }, [role]);

  const accessibleTeams = useMemo(() => {
    if (role === 'admin' || role === 'hr') {
      return teams;
    }
    if (role === 'pm' && profile?.id) {
       return teams.filter(team => team.pmId === profile.id);
    }
    return [];
  }, [role, teams, profile?.id]);

  return { role, canAccessAdmin, accessibleTeams };
}
