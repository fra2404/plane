/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Cake, PartyPopper } from "lucide-react";
import type { TAnniversaryEvent } from "@plane/types";
// services
import { AnniversaryService } from "@/services/anniversary.service";

const anniversaryService = new AnniversaryService();

export const AnniversaryCard = observer(function AnniversaryCard() {
  const { workspaceSlug } = useParams();
  const [events, setEvents] = useState<TAnniversaryEvent[]>([]);

  useEffect(() => {
    if (!workspaceSlug) return;
    let isActive = true;
    anniversaryService
      .fetchUpcoming(String(workspaceSlug), 30)
      .then((data) => {
        if (isActive) setEvents(data ?? []);
      })
      .catch(() => {
        // widget is best-effort
      });
    return () => {
      isActive = false;
    };
  }, [workspaceSlug]);

  if (events.length === 0) return null;

  return (
    <div className="my-4 rounded-lg border border-subtle bg-surface-2 p-4">
      <p className="mb-2 text-body-md-medium text-primary">Compleanni e anniversari</p>
      <div className="space-y-1.5">
        {events.slice(0, 5).map((event) => (
          <div key={`${event.user_id}-${event.type}`} className="flex items-center gap-2 text-body-sm-regular">
            {event.type === "birthday" ? (
              <Cake className="size-3.5 flex-shrink-0 text-accent-primary" />
            ) : (
              <PartyPopper className="size-3.5 flex-shrink-0 text-accent-primary" />
            )}
            <span className="text-primary">{event.display_name}</span>
            <span className="text-tertiary">
              — {event.type === "birthday" ? "compleanno" : `anniversario${event.years ? ` (${event.years} anni)` : ""}`},{" "}
              {event.days_until === 0 ? "oggi" : event.days_until === 1 ? "domani" : `tra ${event.days_until} giorni`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
