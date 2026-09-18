/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// types
import type { TIssue } from "@plane/types";
import { formatWorklogDuration } from "@plane/utils";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: unknown) => void;
  disabled: boolean;
};

export const SpreadsheetTotalLoggedTimeColumn = observer(function SpreadsheetTotalLoggedTimeColumn(props: Props) {
  const { issue } = props;

  return (
    <div className="flex h-11 items-center border-b-[0.5px] border-subtle px-page-x text-13">
      {issue.total_logged_time ? (
        <span className="text-secondary">{formatWorklogDuration(issue.total_logged_time)}</span>
      ) : (
        <span className="text-placeholder">—</span>
      )}
    </div>
  );
});
