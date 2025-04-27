import { useCallback, useRef } from "preact/hooks";

// Debounced function type
type DebouncedFunction = (value: string) => void;

export function useDebounceCallback(callback: DebouncedFunction, delay: number): DebouncedFunction {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((value: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(value);
    }, delay);
  }, [callback, delay]);
} 