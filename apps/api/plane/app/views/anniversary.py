# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date, timedelta

# Django imports
from django.utils import timezone

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import WorkspaceMember

from .base import BaseAPIView


def _next_occurrence(source: date, today: date) -> date:
    """Return the next occurrence of a month/day within the current or next year."""
    try:
        occurrence = source.replace(year=today.year)
    except ValueError:
        # Feb 29 on a non-leap year
        occurrence = date(today.year, 3, 1)
    if occurrence < today:
        try:
            occurrence = occurrence.replace(year=today.year + 1)
        except ValueError:
            occurrence = date(today.year + 1, 3, 1)
    return occurrence


class WorkspaceAnniversaryEndpoint(BaseAPIView):
    """Upcoming birthdays and work anniversaries for the workspace team."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        try:
            days = int(request.GET.get("days", 30))
        except (TypeError, ValueError):
            days = 30

        today = timezone.now().date()
        limit_date = today + timedelta(days=days)

        members = (
            WorkspaceMember.objects.filter(
                workspace__slug=slug,
                is_active=True,
                member__is_active=True,
            )
            .select_related("member", "member__profile")
            .distinct()
        )

        events = []
        for membership in members:
            member = membership.member
            profile = getattr(member, "profile", None)

            birthday = profile.birthday if profile else None
            if birthday:
                occurrence = _next_occurrence(birthday, today)
                if occurrence <= limit_date:
                    events.append(
                        {
                            "user_id": str(member.id),
                            "display_name": member.display_name,
                            "avatar_url": member.avatar_url,
                            "type": "birthday",
                            "date": occurrence.isoformat(),
                            "days_until": (occurrence - today).days,
                            "years": None,
                        }
                    )

            joined = member.date_joined.date() if member.date_joined else None
            if joined:
                occurrence = _next_occurrence(joined, today)
                if occurrence <= limit_date:
                    events.append(
                        {
                            "user_id": str(member.id),
                            "display_name": member.display_name,
                            "avatar_url": member.avatar_url,
                            "type": "anniversary",
                            "date": occurrence.isoformat(),
                            "days_until": (occurrence - today).days,
                            "years": occurrence.year - joined.year,
                        }
                    )

        events.sort(key=lambda event: event["days_until"])
        return Response(events, status=status.HTTP_200_OK)
