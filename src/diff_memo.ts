import { useRef } from "react";

interface DiffMemoState<T> {
  deps: any[];
  value: T;
}

export const useDiffMemo = <T>(f: (prev?: T) => T, deps: any[]): T => {
  const state = useRef<DiffMemoState<T> | null>(null);
  if (state.current === null) {
    const value = f();
    state.current = { deps, value };
    return value;
  } else if (!equalDeps(state.current.deps, deps)) {
    const value = f(state.current.value);
    state.current = { deps, value };
    return value;
  } else {
    return state.current.value;
  }
};

const equalDeps = (deps1: any[], deps2: any[]): boolean => {
  if (deps1.length !== deps2.length) return false;
  for (let i = 0; i < deps1.length; i++) {
    if (deps1[i] !== deps2[i]) {
      return false;
    }
  }
  return true;
}
