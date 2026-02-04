#!/bin/bash
# Outlook OAuth Setup Script (Microsoft Graph API)
# Run this once to authenticate and get tokens for calendar access
#
# Prerequisites:
#   1. Register an app in Azure Portal (https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)
#   2. Add redirect URI: https://localhost/callback
#   3. Add API permissions: Calendars.Read (delegated)
#   4. Create a client secret
#   5. Save credentials to ~/.config/outlook/credentials.json

set -e

CONFIG_DIR="$HOME/.config/outlook"
CREDENTIALS_FILE="$CONFIG_DIR/credentials.json"
TOKENS_FILE="$CONFIG_DIR/tokens.json"

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Check if credentials file exists
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "Error: credentials.json not found!"
    echo "Please create $CREDENTIALS_FILE with:"
    echo '{'
    echo '  "client_id": "YOUR_APP_CLIENT_ID",'
    echo '  "client_secret": "YOUR_CLIENT_SECRET",'
    echo '  "tenant_id": "common",'
    echo '  "redirect_uri": "https://localhost/callback"'
    echo '}'
    echo ""
    echo "To get these values:"
    echo "  1. Go to https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps"
    echo "  2. Register a new application (or use existing)"
    echo "  3. Add redirect URI: https://localhost/callback (Web platform)"
    echo "  4. Under 'Certificates & secrets', create a new client secret"
    echo "  5. Under 'API permissions', add Microsoft Graph > Calendars.Read (delegated)"
    exit 1
fi

# Read credentials (supports 1Password op:// references)
resolve_credential() {
    local value="$1"
    if [[ "$value" == op://* ]]; then
        op read "$value"
    else
        echo "$value"
    fi
}

CLIENT_ID=$(resolve_credential "$(jq -r '.client_id' "$CREDENTIALS_FILE")")
CLIENT_SECRET=$(resolve_credential "$(jq -r '.client_secret' "$CREDENTIALS_FILE")")
TENANT_ID=$(jq -r '.tenant_id // "common"' "$CREDENTIALS_FILE")
REDIRECT_URI=$(jq -r '.redirect_uri // "https://localhost/callback"' "$CREDENTIALS_FILE")

if [ "$CLIENT_ID" = "YOUR_APP_CLIENT_ID" ] || [ -z "$CLIENT_ID" ]; then
    echo "Error: Please update credentials.json with your actual client_id"
    exit 1
fi

# Microsoft identity platform endpoints
AUTH_ENDPOINT="https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/authorize"
TOKEN_ENDPOINT="https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token"

# Function to get authorization URL
get_auth_url() {
    SCOPES="Calendars.Read%20offline_access"
    AUTH_URL="${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=${SCOPES}&response_mode=query"
    echo "$AUTH_URL"
}

# Function to exchange code for tokens
exchange_code() {
    local CODE="$1"

    echo "Exchanging code for tokens..."

    RESPONSE=$(curl -s -X POST "$TOKEN_ENDPOINT" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "client_id=$CLIENT_ID" \
        -d "scope=Calendars.Read offline_access" \
        -d "code=$CODE" \
        -d "redirect_uri=$REDIRECT_URI" \
        -d "grant_type=authorization_code" \
        -d "client_secret=$CLIENT_SECRET")

    # Check for error
    ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')
    if [ -n "$ERROR" ]; then
        echo "Error: $ERROR"
        echo "Description: $(echo "$RESPONSE" | jq -r '.error_description // empty')"
        exit 1
    fi

    # Save tokens
    echo "$RESPONSE" | jq '{
        access_token: .access_token,
        refresh_token: .refresh_token,
        expires_in: .expires_in,
        created_at: (now | floor)
    }' > "$TOKENS_FILE"

    echo "Tokens saved to $TOKENS_FILE"
    echo "Access token expires in: $(echo "$RESPONSE" | jq -r '.expires_in') seconds"
}

# Function to refresh tokens
refresh_tokens() {
    if [ ! -f "$TOKENS_FILE" ]; then
        echo "Error: No tokens file found. Run 'authorize' first."
        exit 1
    fi

    REFRESH_TOKEN=$(jq -r '.refresh_token' "$TOKENS_FILE")

    echo "Refreshing tokens..."

    RESPONSE=$(curl -s -X POST "$TOKEN_ENDPOINT" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "client_id=$CLIENT_ID" \
        -d "scope=Calendars.Read offline_access" \
        -d "refresh_token=$REFRESH_TOKEN" \
        -d "redirect_uri=$REDIRECT_URI" \
        -d "grant_type=refresh_token" \
        -d "client_secret=$CLIENT_SECRET")

    # Check for error
    ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')
    if [ -n "$ERROR" ]; then
        echo "Error: $ERROR"
        echo "Description: $(echo "$RESPONSE" | jq -r '.error_description // empty')"
        exit 1
    fi

    # Save tokens
    echo "$RESPONSE" | jq '{
        access_token: .access_token,
        refresh_token: .refresh_token,
        expires_in: .expires_in,
        created_at: (now | floor)
    }' > "$TOKENS_FILE"

    echo "Tokens refreshed and saved"
}

# Function to test by fetching user profile
get_me() {
    if [ ! -f "$TOKENS_FILE" ]; then
        echo "Error: No tokens file found. Run 'authorize' first."
        exit 1
    fi

    ACCESS_TOKEN=$(jq -r '.access_token' "$TOKENS_FILE")

    curl -s "https://graph.microsoft.com/v1.0/me" \
        -H "Authorization: Bearer $ACCESS_TOKEN" | jq '{
            displayName: .displayName,
            mail: .mail,
            userPrincipalName: .userPrincipalName
        }'
}

# Main
case "${1:-}" in
    authorize)
        AUTH_URL=$(get_auth_url)
        echo ""
        echo "=== Outlook Calendar OAuth Authorization ==="
        echo ""
        echo "1. Open this URL in your browser:"
        echo ""
        echo "$AUTH_URL"
        echo ""
        echo "2. Log in with your Microsoft account and grant calendar access"
        echo ""
        echo "3. You'll be redirected to a page that won't load (that's OK!)"
        echo "   Look at the URL bar - it will look like:"
        echo "   https://localhost/callback?code=XXXXXXX"
        echo ""
        echo "4. Copy the code value and run:"
        echo "   $0 exchange YOUR_CODE_HERE"
        echo ""
        ;;
    exchange)
        if [ -z "${2:-}" ]; then
            echo "Usage: $0 exchange <code>"
            exit 1
        fi
        exchange_code "$2"
        ;;
    refresh)
        refresh_tokens
        ;;
    me)
        get_me
        ;;
    *)
        echo "Outlook Calendar OAuth Helper"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  authorize  - Get the authorization URL"
        echo "  exchange   - Exchange auth code for tokens"
        echo "  refresh    - Refresh expired tokens"
        echo "  me         - Get current user info (test tokens)"
        echo ""
        echo "Setup:"
        echo "  1. Register app at https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps"
        echo "  2. Add redirect URI: https://localhost/callback"
        echo "  3. Add API permission: Microsoft Graph > Calendars.Read (delegated)"
        echo "  4. Create client secret"
        echo "  5. Save to $CREDENTIALS_FILE"
        echo ""
        ;;
esac
