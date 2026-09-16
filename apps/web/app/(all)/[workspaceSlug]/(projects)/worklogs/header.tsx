/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Timer } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Breadcrumbs } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsPageHeader } from "@/components/settings/page-header";

export function WorklogsHeader() {
  const { t } = useTranslation();
  return (
    <SettingsPageHeader
      leftItem={
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink label={t("sidebar.worklogs")} icon={<Timer className="size-4 text-tertiary" />} />
            }
          />
        </Breadcrumbs>
      }
    />
  );
}
