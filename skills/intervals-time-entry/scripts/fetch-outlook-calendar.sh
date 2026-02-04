#!/bin/bash
# Version: 1
# Fetch Outlook calendar events for a specific date via Microsoft Graph API
# Usage: ./fetch-outlook-calendar.sh YYYY-MM-DD [timezone]
#
# Outputs JSON with:
# - Calendar events for the date (subject, start/end, duration, attendees, body)
# - Calculated meeting durations in hours
# - Attendee lists for project/meeting-type inference
#
# Requires: OAuth tokens in ~/.config/outlook/tokens.json
#           (run outlook-oauth.sh authorize first)

set -e

DATE="${1:?Usage: $0 YYYY-MM-DD [timezone]}"
TIMEZONE="${2:-America/New_York}"

CONFIG_DIR="$HOME/.config/outlook"
CREDENTIALS_FILE="$CONFIG_DIR/credentials.json"
TOKENS_FILE="$CONFIG_DIR/tokens.json"

# Validate date format
if ! [[ "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Error: Date must be in YYYY-MM-DD format" >&2
    exit 1
fi

# Check tokens exist
if [ ! -f "$TOKENS_FILE" ]; then
    echo "Error: No tokens file found at $TOKENS_FILE" >&2
    echo "Run outlook-oauth.sh authorize first." >&2
    exit 1
fi

# ============================================================
# TOKEN MANAGEMENT
# ============================================================

resolve_credential() {
    local value="$1"
    if [[ "$value" == op://* ]]; then
        op read "$value"
    else
        echo "$value"
    fi
}

maybe_refresh_token() {
    local created_at=$(jq -r '.created_at' "$TOKENS_FILE")
    local expires_in=$(jq -r '.expires_in' "$TOKENS_FILE")
    local now=$(date +%s)
    local expires_at=$((created_at + expires_in - 300))  # 5 min buffer

    if [ "$now" -gt "$expires_at" ]; then
        echo "Token expired, refreshing..." >&2

        local CLIENT_ID=$(resolve_credential "$(jq -r '.client_id' "$CREDENTIALS_FILE")")
        local CLIENT_SECRET=$(resolve_credential "$(jq -r '.client_secret' "$CREDENTIALS_FILE")")
        local TENANT_ID=$(jq -r '.tenant_id // "common"' "$CREDENTIALS_FILE")
        local REDIRECT_URI=$(jq -r '.redirect_uri // "https://localhost/callback"' "$CREDENTIALS_FILE")
        local REFRESH_TOKEN=$(jq -r '.refresh_token' "$TOKENS_FILE")

        local RESPONSE=$(curl -s -X POST \
            "https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "client_id=$CLIENT_ID" \
            -d "scope=Calendars.Read offline_access" \
            -d "refresh_token=$REFRESH_TOKEN" \
            -d "redirect_uri=$REDIRECT_URI" \
            -d "grant_type=refresh_token" \
            -d "client_secret=$CLIENT_SECRET")

        local ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')
        if [ -n "$ERROR" ]; then
            echo "Error refreshing token: $ERROR" >&2
            echo "$(echo "$RESPONSE" | jq -r '.error_description // empty')" >&2
            exit 1
        fi

        echo "$RESPONSE" | jq '{
            access_token: .access_token,
            refresh_token: .refresh_token,
            expires_in: .expires_in,
            created_at: (now | floor)
        }' > "$TOKENS_FILE"

        echo "Token refreshed" >&2
    fi
}

get_access_token() {
    maybe_refresh_token
    jq -r '.access_token' "$TOKENS_FILE"
}

# ============================================================
# FETCH CALENDAR EVENTS
# ============================================================

ACCESS_TOKEN=$(get_access_token)

# Calculate next day for the date range (Linux and macOS compatible)
NEXT_DATE=$(date -d "$DATE + 1 day" +%Y-%m-%d 2>/dev/null || date -v+1d -j -f "%Y-%m-%d" "$DATE" +%Y-%m-%d)

# Use calendarView to get expanded recurring events for the date
# Prefer header for timezone to get times in local timezone
RESPONSE=$(curl -s "https://graph.microsoft.com/v1.0/me/calendarView?\$orderby=start/dateTime&\$top=50&startDateTime=${DATE}T00:00:00&endDateTime=${NEXT_DATE}T00:00:00" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Prefer: outlook.timezone=\"$TIMEZONE\"" \
    -H "Content-Type: application/json")

# Check for API error
ERROR=$(echo "$RESPONSE" | jq -r '.error.code // empty')
if [ -n "$ERROR" ]; then
    echo "Error fetching calendar: $ERROR" >&2
    echo "$(echo "$RESPONSE" | jq -r '.error.message // empty')" >&2
    exit 1
fi

# Process events into structured output
echo "$RESPONSE" | jq --arg date "$DATE" --arg tz "$TIMEZONE" '{
    date: $date,
    timezone: $tz,
    events: [
        .value[] |
        select(.isCancelled != true) |
        {
            subject: .subject,
            start: .start.dateTime,
            end: .end.dateTime,
            start_time: (.start.dateTime | split("T")[1] | split(".")[0] | .[0:5]),
            end_time: (.end.dateTime | split("T")[1] | split(".")[0] | .[0:5]),
            duration_hours: (
                ((.end.dateTime | split("T") |
                    ((.[0] | split("-") | (.[0] | tonumber) * 365 * 24 + (.[1] | tonumber) * 30 * 24 + (.[2] | tonumber) * 24) +
                     (.[1] | split(".")[0] | split(":") | (.[0] | tonumber) + (.[1] | tonumber) / 60 + (.[2] | tonumber) / 3600))
                ) -
                (.start.dateTime | split("T") |
                    ((.[0] | split("-") | (.[0] | tonumber) * 365 * 24 + (.[1] | tonumber) * 30 * 24 + (.[2] | tonumber) * 24) +
                     (.[1] | split(".")[0] | split(":") | (.[0] | tonumber) + (.[1] | tonumber) / 60 + (.[2] | tonumber) / 3600))
                ))
                | . * 100 | round / 100
            ),
            is_all_day: .isAllDay,
            location: (.location.displayName // null),
            organizer: .organizer.emailAddress.name,
            organizer_email: .organizer.emailAddress.address,
            attendees: [
                .attendees[]? |
                {
                    name: .emailAddress.name,
                    email: .emailAddress.address,
                    status: .status.response,
                    type: .type
                }
            ],
            response_status: .responseStatus.response,
            body_preview: (.bodyPreview // "" | .[0:500]),
            categories: (.categories // []),
            is_online_meeting: (.isOnlineMeeting // false),
            online_meeting_url: (.onlineMeeting.joinUrl // null),
            series_id: (.seriesMasterId // null),
            show_as: (.showAs // null),
            importance: (.importance // null)
        }
    ] | sort_by(.start),
    summary: {
        total_events: ([.value[] | select(.isCancelled != true)] | length),
        total_meeting_hours: (
            [.value[] | select(.isCancelled != true and .isAllDay != true) |
                ((.end.dateTime | split("T") |
                    ((.[0] | split("-") | (.[0] | tonumber) * 365 * 24 + (.[1] | tonumber) * 30 * 24 + (.[2] | tonumber) * 24) +
                     (.[1] | split(".")[0] | split(":") | (.[0] | tonumber) + (.[1] | tonumber) / 60 + (.[2] | tonumber) / 3600))
                ) -
                (.start.dateTime | split("T") |
                    ((.[0] | split("-") | (.[0] | tonumber) * 365 * 24 + (.[1] | tonumber) * 30 * 24 + (.[2] | tonumber) * 24) +
                     (.[1] | split(".")[0] | split(":") | (.[0] | tonumber) + (.[1] | tonumber) / 60 + (.[2] | tonumber) / 3600))
                ))
            ] | add // 0 | . * 100 | round / 100
        ),
        all_day_events: ([.value[] | select(.isCancelled != true and .isAllDay == true)] | length)
    }
}'
