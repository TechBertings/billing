import { useState, useEffect } from 'react';
import { canApprovePage, loadPermissionsForRole } from '../Maintenance/RolePermission';

export function useApprovalPermission(currentUser, pageKey) {
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!currentUser?.role || !pageKey) {
      setCanApprove(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      setLoading(true);
      await loadPermissionsForRole(currentUser.role);
      const result = canApprovePage(currentUser.role, pageKey);
      setCanApprove(result);
      setLoading(false);
    };

    check();
  }, [currentUser?.role, pageKey]);

  return { canApprove, loading };
}