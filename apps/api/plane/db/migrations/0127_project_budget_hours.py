# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0126_intranet_client_contact"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="budget_hours",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
