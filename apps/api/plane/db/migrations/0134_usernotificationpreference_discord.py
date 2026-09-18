# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0133_workspace_team_member"),
    ]

    operations = [
        migrations.AddField(
            model_name="usernotificationpreference",
            name="discord_assignment",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="usernotificationpreference",
            name="discord_comment",
            field=models.BooleanField(default=False),
        ),
    ]
