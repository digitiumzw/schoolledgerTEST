import { useMutation } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { ImportExecuteResult, ImportValidationResult } from '@/types/dashboard';

export function useValidateImport() {
  return useMutation<ImportValidationResult, Error, File>({
    mutationFn: (file) => api.validateStudentImport(file),
  });
}

export function useExecuteImport() {
  return useMutation<ImportExecuteResult, Error, File>({
    mutationFn: (file) => api.executeStudentImport(file),
  });
}
