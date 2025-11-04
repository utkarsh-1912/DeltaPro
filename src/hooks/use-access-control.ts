
"use client";

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useRotaStore } from '@/lib/store';

export function useAccessControl() {
  const { profile } = useAuthStore();
  const { teams } = useRotaStore();

  const role = profile?.role || 'user';
  const userId = profile?.id;
  
  const canAccessAdmin = useMemo(() => {
    return role === 'admin' || role === 'hr' || role === 'pm';
  }, [role]);

  const accessibleTeams = useMemo(() => {
    if (role === 'admin' || role === 'hr') {
      return teams;
    }
    if (role === 'pm') {
      // Find all members with the current user's email, as a user could be a "member" multiple times in different teams
      // but their login is the same. We need their "member id" from the teamMembers list.
      const pmAsMember = useRotaStore.getState().teamMembers.find(m => m.email === profile?.email);
      if (!pmAsMember) return [];
      return teams.filter(team => team.pmId === pmAsMember.id);
    }
    return [];
  }, [role, teams, userId, profile?.email]);

  return { role, canAccessAdmin, accessibleTeams };
}
