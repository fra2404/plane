# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0128_profile_birthday"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="budget_months",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
