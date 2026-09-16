# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0131_worklog_payment"),
    ]

    operations = [
        migrations.AddField(
            model_name="worklogpayment",
            name="duration",
            field=models.PositiveIntegerField(default=0, verbose_name="Duration covered (seconds)"),
        ),
        migrations.RemoveConstraint(
            model_name="worklogpayment",
            name="worklog_payment_unique_project_actor_month",
        ),
        migrations.AlterModelOptions(
            name="worklogpayment",
            options={
                "ordering": ("-month", "project_id", "paid_at", "-created_at"),
                "verbose_name": "Worklog Payment",
                "verbose_name_plural": "Worklog Payments",
            },
        ),
    ]
