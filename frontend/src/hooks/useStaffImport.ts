import { useMutation } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { ImportExecuteResult, ImportValidationResult } from '@/types/dashboard';

export function useValidateStaffImport() {
  return useMutation<ImportValidationResult, Error, File>({
    mutationFn: (file) => api.validateStaffImport(file),
  });
}

export function useExecuteStaffImport() {
  return useMutation<ImportExecuteResult, Error, File>({
    mutationFn: (file) => api.executeStaffImport(file),
  });
}
