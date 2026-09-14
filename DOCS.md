# Dink&Done — Tester Documentation

Zero-hassle pickleball queue and match management. This document covers every feature — who does what, how it works, and what to verify when testing.

---

## Table of Contents

1. [What is this app?](#what-is-this-app)
2. [Two Roles](#two-roles)
3. [Creating a Session (Host)](#creating-a-session)
4. [Game Modes](#game-modes)
5. [Managing Matches (Host)](#managing-matches)
6. [Host Tools](#host-tools)
7. [Ending the Session](#ending-the-session)
8. [Joining a Session (Player)](#joining-a-session)
9. [Player View](#player-view)
10. [Reporting a Loss](#reporting-a-loss)
11. [Recovery Codes](#recovery-codes)
12. [Session Limits](#session-limits)
13. [Testing Checklist](#testing-checklist)

---

## What is this app?

Dink&Done manages player rotation on pickleball courts. Instead of everyone arguing about whose turn it is, one person (the **host**) creates a session, shares a QR code, players scan it to join the queue, and the app tells everyone when to play.

It works entirely in the browser — no app download needed. The host controls matches from their device; everyone else just watches their queue position update in real time.

---

## Two Roles

| Role | Who | What they do |
|---|---|---|
| **Host** | The organizer | Creates the session, manages courts, starts and ends matches, decides who wins |
| **Player** | Everyone else | Joins via QR code or link, sees their queue position, reports match results |

There is one host per session and up to 100 players.

---

## Creating a Session

> **Role: Host**

Go to the home page and fill in the form:

1. **Group / Session Name** — whatever your group calls itself (e.g. "Tuesday Night Picklers"). Players see this when they join. Up to 60 characters.
2. **Number of Courts** — tap a quick-select button (1–6) or type a custom number up to 20. Each court runs its own match independently.
3. **Game Mode** — choose between **Win / Lose** or **Pure Queue** (see [Game Modes](#game-modes) below).

Tap **Create Session**. The app generates a unique session code and takes you straight to the host dashboard. Your host password is saved automatically in your browser — you won't need to enter it again on the same device.

> **Note:** Don't close the tab immediately. Your host password is saved to this browser only. If you need to come back from a different device, use the host recovery code shown on the dashboard.

---

## Game Modes

The mode controls how players are grouped after each match.

### Win / Lose *(tracks results)*

After each match, winners are tagged **"won"** and losers **"lost."** The next match tries to group winners against winners and losers against losers. Everyone returns to the queue after playing — no one sits out permanently. If there aren't enough tagged players in one tier to fill a court, the app falls back to general queue order.

### Pure Queue *(no tracking)*

Simple first-in, first-out rotation. The next 4 players in the queue play. No win or loss is recorded. After a match ends, all 4 players go back to the end of the queue. The host can also choose **No winner / Skip** when ending a match.

---

## Managing Matches

> **Role: Host**

### Starting the session

After creating the session, players can join but no matches start yet. Press **Start Session** on the host dashboard when you're ready. The app fills all courts automatically from the queue.

### How courts work

Each court is colour-coded on the dashboard (yellow, blue, green, purple…). Each court card shows:
- The two teams currently playing
- How long the match has been running
- An **End Match** button

Courts fill automatically when a match ends. If a court has no active match, a **Fill Court** button appears.

### Ending a match

Tap **End Match** on any active court card. A modal appears:

| Mode | Options |
|---|---|
| Win / Lose | Team A Won · Team B Won |
| Pure Queue | Team A Won · Team B Won · No winner / Skip |

Select the winning team (or skip). The app tags players, returns them to the queue, and immediately fills the court with the next group.

---

## Host Tools

> **Role: Host**

### Rearrange teams

On any active match, tap the **rearrange icon** (two arrows) on the court card. A team-setup modal opens showing all 4 players. Tap one player to select them, then tap another to swap positions. Tap **Save** to apply the new arrangement.

### Switch a player mid-match

Tap a player's name on an active court to open the **Switch Player** modal. Choose any waiting player from the queue to substitute in. The swapped-out player returns to the queue. Useful if someone needs to sit out unexpectedly.

### Shuffle the queue

The **Shuffle** button randomises the order of all waiting players. In Win / Lose mode, it also resets win/loss tags — giving everyone a fresh start.

### Remove a player

In the player list at the bottom of the host dashboard, each player has a **delete (trash) icon**. Tap once to arm the confirmation, then tap again to confirm removal.

### QR code & join link

The host dashboard shows a QR code and a copyable join link. Share either to let players join. The link format is `/join/[session-code]`.

### Board link

A separate **Board** link (`/board/[session-code]`) shows a read-only view of current matches and the queue. Good for projecting on a screen at the venue.

### Idle timer

The host dashboard shows how long ago the last match activity was. Sessions auto-expire after 90 minutes of inactivity.

---

## Ending the Session

> **Role: Host**

Tap **End Session** in the host dashboard. A confirmation modal appears — confirm to close the session. All players see a "Session Ended" screen. The host is redirected to the home page. **This action cannot be undone.**

---

## Joining a Session

> **Role: Player**

1. Scan the QR code the host shows, or open the link they share.
2. On the join page, tap **New Player** and enter your name (up to 30 characters).
3. Tap **Join Queue** — you're in.
4. A **Recovery Code** screen appears — write it down or copy it. This is your way back if you lose connection.
5. Tap **Got it — Take me to the Queue** to see your position.

> **Save the recovery code.** It's shown only once after joining. If you reopen the same browser on the same device, the app restores you automatically. On a new device or after clearing browser data, you'll need the code to rejoin.

---

## Player View

After joining, the player page shows one of two states:

**In the Queue**
Shows your position number and the names of everyone waiting ahead of you. Updates every 5 seconds automatically.

**On Court**
When it's your turn, the card turns green and shows your court number, both teams, and a **We Lost** button (in Win / Lose mode).

Your recovery code is always visible at the bottom of the page as a reminder.

---

## Reporting a Loss

> **Role: Player — Win / Lose mode only**

If your team lost, tap **We Lost** on your player screen. Your partner needs to tap it too — once both losing-team players confirm, the match ends automatically without the host needing to do anything.

The host can always end matches manually regardless of whether players have reported.

---

## Recovery Codes

### Player recovery code

Every player gets a unique 10-character code when they first join (e.g. `A3X9K2M7P1`).

To use it:
1. Open the join link for the session.
2. Tap the **Rejoin** tab.
3. Enter your recovery code and tap **Rejoin Queue**.

### Host recovery code

If you leave the host dashboard and lose your browser session:
1. Go to the home page.
2. Tap **Recover host session** (small link at the bottom).
3. Enter your 10-character host code.
4. Tap **Recover Session**.

The host code is shown on the host dashboard — copy it before going onto the court.

---

## Session Limits

| Limit | Value | What happens when hit |
|---|---|---|
| Concurrent sessions | 10 | Home page shows "Server at capacity" — no new sessions until one expires or ends |
| Players per session | 100 | Join attempts are rejected with an error message |
| Courts per session | 1–20 | Form validation blocks values outside this range |
| Idle expiry | 90 minutes | Session is automatically deleted; players see "Session Ended" |

---

## Testing Checklist

### Session creation
- [ ] Create a session with **Win / Lose** mode — confirm correct label shows on the host dashboard
- [ ] Create a session with **Pure Queue** mode — confirm correct label shows
- [ ] Try entering 0 or a negative number of courts — should be blocked
- [ ] Create a session with 1 court and one with 6+ courts

### Joining
- [ ] Join from a second device using the QR code
- [ ] Join from a second device using the copied link
- [ ] Copy and save the player recovery code on join
- [ ] Close and reopen the browser on the same device — should auto-restore to the queue
- [ ] Use the recovery code on a different device to rejoin
- [ ] Try opening a join link for a session that doesn't exist — should show "Session Ended"

### Match flow — Win / Lose mode
- [ ] Start a session and confirm courts fill automatically
- [ ] End a match by selecting Team A wins — confirm players return to queue
- [ ] End a match by selecting Team B wins
- [ ] Have both losing-team players tap "We Lost" — confirm match auto-ends
- [ ] Have only one player tap "We Lost" — confirm nothing happens until partner confirms
- [ ] Confirm the next match groups winners vs winners when enough tagged players exist

### Match flow — Pure Queue mode
- [ ] End a match with a winner selected — all 4 players return to queue
- [ ] End a match using "No winner / Skip" — all 4 return with no result tags
- [ ] Confirm players do **not** see a "We Lost" button in this mode

### Host tools
- [ ] Rearrange teams on an active match and confirm the change saves
- [ ] Switch a player from the queue into an active match
- [ ] Shuffle the queue and confirm order changes
- [ ] Delete a waiting player — confirm they're removed from the list
- [ ] Copy the host recovery code; use it from a different browser to regain host access

### Edge cases
- [ ] Start a session with fewer players than needed to fill all courts — confirm partial fill works
- [ ] End session while a match is in progress
- [ ] Open the board link on a separate device and confirm it reflects live state
- [ ] Leave the session idle for 90+ minutes — session should expire automatically
