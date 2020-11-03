import { useDebugValue, useRef } from "react";

interface DiffMemoState<T> {
  deps: unknown[];
  value: T;
}

export const useDiffMemo = <T>(f: (prev?: T) => T, deps: unknown[]): T => {
  const state = useRef<DiffMemoState<T> | null>(null);
  if (state.current === null) {
    const value = f();
    state.current = { deps, value };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDebugValue(value);
    return value;
  } else if (!equalDeps(state.current.deps, deps)) {
    const value = f(state.current.value);
    state.current = { deps, value };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDebugValue(value);
    return value;
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDebugValue(state.current.value);
    return state.current.value;
  }
};

const equalDeps = (deps1: unknown[], deps2: unknown[]): boolean => {
  if (deps1.length !== deps2.length) return false;
  for (let i = 0; i < deps1.length; i++) {
    if (deps1[i] !== deps2[i]) {
      return false;
    }
  }
  return true;
};
