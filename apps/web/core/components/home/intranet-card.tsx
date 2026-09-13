/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Network } from "lucide-react";

export function IntranetCard() {
  const { workspaceSlug } = useParams();
  if (!workspaceSlug) return null;

  return (
    <Link
      href={`/${workspaceSlug}/intranet/`}
      className="my-4 flex items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-2 p-4 transition hover:border-strong"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 flex-shrink-0 place-items-center rounded-md bg-accent-primary/10">
          <Network className="size-4 text-accent-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-body-md-medium text-primary">Intranet</p>
          <p className="truncate text-body-xs-regular text-tertiary">
            Elenco IP e dispositivi, link utili e news del workspace
          </p>
        </div>
      </div>
      <ArrowRight className="size-4 flex-shrink-0 text-tertiary" />
    </Link>
  );
}
