import { useEffect, useState } from "react";

/** True once `active` has stayed true for `ms`; resets when it turns false. Keeps skeletons from flashing on fast loads. */
export function useAfter(ms: number, active: boolean): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) { setOn(false); return; }
    const id = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(id);
  }, [ms, active]);
  return on && active;
}
