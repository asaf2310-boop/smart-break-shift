import { useEffect, useState } from "react";
import { isTrainingCourseVisibleForAgents, resolveTrainingSchedule } from "@/lib/trainingSchedule";
import {
  hydrateTrainingScheduleStore,
  subscribeTrainingScheduleStore,
} from "@/lib/trainingScheduleStore";

export function useTrainingCourseVisible() {
  const [visible, setVisible] = useState(() =>
    isTrainingCourseVisibleForAgents(resolveTrainingSchedule())
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      setVisible(isTrainingCourseVisibleForAgents(resolveTrainingSchedule()));
    };

    hydrateTrainingScheduleStore()
      .then(() => {
        if (!cancelled) {
          sync();
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    const unsub = subscribeTrainingScheduleStore(sync);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { visible, ready };
}
