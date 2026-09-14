# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0124_intranet_models"),
    ]

    operations = [
        migrations.AlterField(
            model_name="project",
            name="is_time_tracking_enabled",
            field=models.BooleanField(default=True),
        ),
    ]
