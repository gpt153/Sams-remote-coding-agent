# Slack Bot Setup Guide

This guide walks you through creating a Slack app with Socket Mode for the Remote Coding Agent.

## Overview

The remote coding agent uses **Socket Mode** for Slack integration, which means:

- No public HTTP endpoints needed
- Works behind firewalls
- Simpler local development
- Not suitable for Slack App Directory (fine for personal/team use)

## Step 1: Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Log in if prompted
3. Choose the workspace for your app
4. Click **Create New App**
5. Choose **From scratch**
6. Enter:
   - **App Name**: Any name (this is what you will use to @mention the bot)
   - **Workspace**: Select your workspace
7. Click **Create App**

## Step 2: Enable Socket Mode

1. In the left sidebar, click **Socket Mode**
2. Toggle **Enable Socket Mode** to ON
3. When prompted, create an App-Level Token:
   - **Token Name**: `socket-mode`
   - **Scopes**: Add `connections:write`
   - Click **Generate**
4. **Copy the token** (starts with `xapp-`) - this is your `SLACK_APP_TOKEN`
5. Copy the token and put it in your .env file

## Step 3: Configure Bot Scopes

1. In the left sidebar, click **OAuth & Permissions**
2. Scroll down to **Scopes** > **Bot Token Scopes**
3. Add these scopes to bot token scopes:
   - `app_mentions:read` - Receive @mention events
   - `chat:write` - Send messages
   - `channels:history` - Read messages in public channels (for thread context)
   - `channels:join` - Allow bot to join public channels
   - `groups:history` - Read messages in private channels (optional)
   - `im:history` - Read DM history (for DM support)
   - `im:write` - Send DMs
   - `im:read` - Read DM history (for DM support)
   - `mpim:history` - Read group DM history (optional)
   - `mpim:write` - Send group DMs

## Step 4: Subscribe to Events

1. In the left sidebar, click **Event Subscriptions**
2. Toggle **Enable Events** to ON
3. Under **Subscribe to bot events**, add:
   - `app_mention` - When someone @mentions your bot
   - `message.im` - Direct messages to your bot
   - `message.channels` - Messages in public channels (optional, for broader context)
   - `message.groups` - Messages in private channels (optional)
4. Click **Save Changes**

## Step 5: Install to Workspace

1. In the left sidebar, click **Install App**
2. Click **Install to Workspace**
3. Review the permissions and click **Allow**
4. **Copy the Bot User OAuth Token** (starts with `xoxb-`) - this is your `SLACK_BOT_TOKEN`
5. Set the bot token in your `.env` file

## Step 6: Configure Environment Variables

Add to your `.env` file:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# Optional: Restrict to specific users
SLACK_ALLOWED_USER_IDS=U1234ABCD,W5678EFGH

# Optional: Streaming mode (batch is default for Slack)
SLACK_STREAMING_MODE=batch
```

## Step 7: Invite Bot to Channel

1. Go to the Slack channel where you want to use the bot
2. Type `/invite @agent-name` (your bot's name)
3. The bot should now respond to @mentions in that channel

## Usage

### Clone a Repository (Main Channel)

```
@Remote Coding Agent /clone https://github.com/user/repo
```

### Continue Work (Thread)

Reply in the thread created by the clone message:

```
@Remote Coding Agent /status
```

### Start Parallel Work (Worktree)

```
@Remote Coding Agent /worktree feature-branch
```

### Direct Messages

You can also DM the bot directly - no @mention needed:

```
/help
```

## Troubleshooting

### Bot Doesn't Respond

1. Check that Socket Mode is enabled
2. Verify both tokens are correct in `.env`
3. Check the app logs for errors
4. Ensure the bot is invited to the channel
5. Make sure you're @mentioning the bot (not just typing)

### "channel_not_found" Error

The bot needs to be invited to the channel:

```
/invite @Remote Coding Agent
```

### "missing_scope" Error

Add the required scope in **OAuth & Permissions** and reinstall the app.

### Thread Context Not Working

Ensure these scopes are added:

- `channels:history` (public channels)
- `groups:history` (private channels)

## Finding User IDs

To restrict access to specific users:

1. In Slack, click on a user's profile
2. Click the **...** (More) button
3. Click **Copy member ID**
4. Add to `SLACK_ALLOWED_USER_IDS`

## Security Recommendations

1. **Use User Whitelist**: Set `SLACK_ALLOWED_USER_IDS` to restrict bot access
2. **Private Channels**: Invite the bot only to channels where it's needed
3. **Token Security**: Never commit tokens to version control

## Reference Links

- [Slack API Documentation](https://api.slack.com/docs)
- [Bolt for JavaScript](https://tools.slack.dev/bolt-js/)
- [Socket Mode Guide](https://api.slack.com/apis/connections/socket)
- [Permission Scopes](https://api.slack.com/scopes)
