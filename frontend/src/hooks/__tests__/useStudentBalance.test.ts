import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStudentBalance } from '../useStudentBalance';

// Mock the API
jest.mock('../../api/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

describe('useStudentBalance', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  it('should fetch student balance successfully', async () => {
    const mockBalance = {
      studentId: 's123',
      totalCharges: 600,
      totalPayments: 300,
      creditAdjustments: 50,
      debitAdjustments: 0,
      balance: 250,
    };

    const { api } = require('../../api/api');
    api.get.mockResolvedValue({ data: { data: mockBalance } });

    const { result } = renderHook(() => useStudentBalance('s123'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.balance).toEqual(mockBalance);
    expect(result.current.error).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/ledger/student/s123/balance');
  });

  it('should handle API errors', async () => {
    const { api } = require('../../api/api');
    api.get.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useStudentBalance('s123'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.balance).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('should not fetch when studentId is empty', () => {
    const { api } = require('../../api/api');
    api.get.mockClear();

    renderHook(() => useStudentBalance(''), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    expect(api.get).not.toHaveBeenCalled();
  });

  it('should provide invalidateBalance function', () => {
    const { result } = renderHook(() => useStudentBalance('s123'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    expect(typeof result.current.invalidateBalance).toBe('function');
  });
});
