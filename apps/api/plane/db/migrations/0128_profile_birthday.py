# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0127_project_budget_hours"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="birthday",
            field=models.DateField(blank=True, null=True),
        ),
    ]
