import { useEffect, useState } from "react";
import type { PersonaReactions } from "@mimica/shared";

export function usePersonaReactions(): PersonaReactions | undefined {
  const [reactions, setReactions] = useState<PersonaReactions | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void window.mimica.getPersonaReactions().then((loaded) => {
      if (!cancelled && loaded) {
        setReactions(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return reactions;
}
