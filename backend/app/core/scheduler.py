"""
Background scheduler — keeps trending tickers' news fresh automatically,
checks price alerts, and sends weekly watchlist digests.

Strategy:
  Every INGEST_INTERVAL_MINUTES (default 30), we:
    1. Query the top N tickers by recent mention count.
       If the DB is empty / stale, fall back to a default seed list so the
       scheduler can bootstrap itself on a fresh deployment.
    2. Ingest fresh news for each ticker (Finnhub + RSS + NewsAPI in parallel).
    3. Bust the in-process cache so the next API hit returns new data.

  Every 15 minutes:
    - Check all untriggered price alerts and email users when targets are hit.

  Every Monday at 8am:
    - Send each user with watchlist items a weekly sentiment digest email.

The scheduler runs in daemon threads so they die cleanly with the process.
It is safe to use under Flask's dev server (single-process) or any WSGI
server that runs a single worker process (Gunicorn --workers=1).
"""

# Default seed list — used when the DB has no recent data (fresh deploy / cold start)
DEFAULT_SEED_TICKERS = [
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "AMD",
    "PLTR", "SOFI", "SPY", "QQQ", "COIN", "ARM", "AVGO", "JPM",
    "BAC", "RIVN", "F", "MSTR",
]
from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta, timezone

_started = False
_lock = threading.Lock()


def _run_cycle(app, top_n: int = 20) -> None:
    """Single ingest cycle — called inside app context."""
    from sqlalchemy import func
    from app.db.models import Mention
    from app.extensions import db
    from app.services.news.pipeline import ingest_news_for_ticker
    from app.core.cache import delete as cache_delete

    cutoff = datetime.now(timezone.utc) - timedelta(hours=72)

    try:
        rows = (
            db.session.query(Mention.ticker, func.count(Mention.id).label("cnt"))
            .filter(Mention.published_at >= cutoff)
            .group_by(Mention.ticker)
            .order_by(func.count(Mention.id).desc())
            .limit(top_n)
            .all()
        )
        tickers = [r[0] for r in rows]
    except Exception as exc:
        print(f"[scheduler] failed to query trending tickers: {exc}")
        return

    if not tickers:
        print("[scheduler] no trending tickers in DB — using default seed list to bootstrap")
        tickers = DEFAULT_SEED_TICKERS

    print(f"[scheduler] ingesting {len(tickers)} tickers: {', '.join(tickers)}")
    ok = 0
    from app.services.sentiment import snapshot_ticker
    for ticker in tickers:
        try:
            ingested = ingest_news_for_ticker(ticker, days=3)
            print(f"[scheduler]   {ticker}: +{len(ingested)} articles")
            try:
                snapshot_ticker(ticker)
            except Exception as snap_exc:
                print(f"[scheduler]   {ticker}: snapshot error — {snap_exc}")
            ok += 1
        except Exception as exc:
            print(f"[scheduler]   {ticker}: error — {exc}")

    # Bust top-level caches so next request reflects new data
    for key in ("feed", "trending", "shifters"):
        cache_delete(key)

    print(f"[scheduler] cycle done — {ok}/{len(tickers)} tickers refreshed")


def _scheduler_loop(app, interval_seconds: int) -> None:
    """Infinite loop that sleeps between cycles."""
    # Small initial delay so the app finishes starting up first
    time.sleep(15)
    while True:
        try:
            with app.app_context():
                _run_cycle(app)
        except Exception as exc:
            print(f"[scheduler] unexpected error in cycle: {exc}")
        time.sleep(interval_seconds)


# ─── Price Alert helpers ──────────────────────────────────────────────────────

def _send_alert_email(to: str, username: str, ticker: str, direction: str, target: float, current: float):
    from app.core.mail import send_email
    from app.core import config
    arrow = '\u2191' if direction == 'above' else '\u2193'
    color = '#22c55e' if direction == 'above' else '#ef4444'
    html = f"""
    <div style="font-family:monospace;max-width:520px;margin:0 auto;padding:40px 32px;background:#0a0a0a;color:#e5e5e5">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:{color};margin:0 0 24px">SentimentSignal \u2014 Price Alert</p>
      <h1 style="font-size:20px;font-weight:900;margin:0 0 8px">{arrow} {ticker} hit your target</h1>
      <p style="font-size:13px;color:#a3a3a3;margin:0 0 24px">Hey {username}, your price alert was triggered.</p>
      <div style="border:1px solid {color}22;background:{color}0a;padding:20px;margin:0 0 24px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em">Target</span>
          <span style="font-size:14px;font-weight:700;color:{color}">{direction.upper()} ${target:,.2f}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.1em">Current Price</span>
          <span style="font-size:14px;font-weight:700;color:#e5e5e5">${current:,.2f}</span>
        </div>
      </div>
      <a href="{config.FRONTEND_URL}/app/stock/{ticker}"
         style="display:inline-block;background:{color};color:#000;font-size:11px;font-weight:700;
                letter-spacing:0.15em;text-transform:uppercase;padding:10px 20px;text-decoration:none">
        View {ticker} \u2192
      </a>
    </div>
    """
    try:
        send_email(to, f"\U0001f6a8 {ticker} {direction} ${target:,.2f} \u2014 SentimentSignal Alert", html)
    except Exception as e:
        print(f"[alerts] Email failed for {to}: {e}")


def check_price_alerts(app):
    """Check all active price alerts and trigger emails when targets are hit."""
    from collections import defaultdict
    import datetime as dt
    from app.db.models import PriceAlert, User
    from app.extensions import db

    with app.app_context():
        # Get all untriggered alerts
        alerts = PriceAlert.query.filter_by(triggered=False).all()
        if not alerts:
            return

        # Group by ticker to minimize API calls
        by_ticker = defaultdict(list)
        for a in alerts:
            by_ticker[a.ticker].append(a)

        triggered_count = 0
        for ticker, ticker_alerts in by_ticker.items():
            try:
                from app.services.finnhub import get_quote
                quote = get_quote(ticker)
                if not quote:
                    continue
                current_price = quote.get('price')
                if not current_price:
                    continue

                for alert in ticker_alerts:
                    hit = (
                        (alert.direction == 'above' and current_price >= alert.target_price) or
                        (alert.direction == 'below' and current_price <= alert.target_price)
                    )
                    if hit:
                        alert.triggered = True
                        alert.triggered_at = dt.datetime.utcnow()

                        user = User.query.get(alert.user_id)
                        if user:
                            _send_alert_email(
                                user.email,
                                user.username or user.email,
                                ticker,
                                alert.direction,
                                alert.target_price,
                                current_price,
                            )
                        triggered_count += 1

            except Exception as e:
                print(f"[alerts] Error checking {ticker}: {e}")

        if triggered_count:
            db.session.commit()
            print(f"[alerts] Triggered {triggered_count} price alerts")


def _price_alert_loop(app, interval_seconds: int) -> None:
    """Infinite loop that checks price alerts on a fixed interval."""
    time.sleep(30)  # brief startup delay
    while True:
        try:
            check_price_alerts(app)
        except Exception as exc:
            print(f"[alerts] unexpected error: {exc}")
        time.sleep(interval_seconds)


# ─── Weekly watchlist digest ──────────────────────────────────────────────────

def send_watchlist_digests(app):
    """Send weekly watchlist sentiment digest to all users with watchlists."""
    with app.app_context():
        from sqlalchemy import func
        import datetime as dt
        from app.db.models import User, WatchlistList, WatchlistListItem, Mention
        from app.extensions import db
        from app.core.mail import send_email
        from app.core import config

        since = dt.datetime.utcnow() - dt.timedelta(days=7)

        # Get all users who have items in any named watchlist
        users_with_watchlists = (
            db.session.query(User)
            .join(WatchlistList, WatchlistList.user_id == User.id)
            .join(WatchlistListItem, WatchlistListItem.list_id == WatchlistList.id)
            .distinct()
            .all()
        )

        sent = 0
        for user in users_with_watchlists:
            try:
                items = (
                    db.session.query(WatchlistListItem.ticker)
                    .join(WatchlistList, WatchlistList.id == WatchlistListItem.list_id)
                    .filter(WatchlistList.user_id == user.id)
                    .distinct()
                    .all()
                )
                tickers = [i.ticker for i in items]
                if not tickers:
                    continue

                rows = []
                for ticker in tickers[:10]:
                    stats = (
                        db.session.query(
                            func.avg(Mention.sentiment_score).label('avg'),
                            func.count(Mention.id).label('count'),
                        )
                        .filter(
                            Mention.ticker == ticker,
                            Mention.published_at >= since,
                        )
                        .first()
                    )
                    avg = round(float(stats.avg or 0), 3)
                    count = stats.count or 0
                    label = 'Bullish' if avg > 0.05 else 'Bearish' if avg < -0.05 else 'Neutral'
                    color = '#22c55e' if avg > 0.05 else '#ef4444' if avg < -0.05 else '#888888'
                    rows.append({'ticker': ticker, 'avg': avg, 'count': count, 'label': label, 'color': color})

                if not rows:
                    continue

                rows_html = ''.join([
                    f"""<tr>
                      <td style="padding:10px 16px;font-weight:700;color:#e5e5e5">{r['ticker']}</td>
                      <td style="padding:10px 16px;color:{r['color']};font-weight:700">{r['label']}</td>
                      <td style="padding:10px 16px;color:{r['color']}">{'+' if r['avg'] > 0 else ''}{r['avg']:.3f}</td>
                      <td style="padding:10px 16px;color:#888">{r['count']} articles</td>
                    </tr>"""
                    for r in rows
                ])

                display = user.username or user.email.split('@')[0]
                html = f"""
                <div style="font-family:monospace;max-width:560px;margin:0 auto;padding:40px 32px;background:#0a0a0a;color:#e5e5e5">
                  <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#22c55e;margin:0 0 24px">SentimentSignal \u2014 Weekly Digest</p>
                  <h1 style="font-size:20px;font-weight:900;margin:0 0 4px">Your Weekly Watchlist Report</h1>
                  <p style="font-size:12px;color:#888;margin:0 0 24px">Sentiment summary for the past 7 days</p>
                  <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead>
                      <tr style="border-bottom:1px solid #222">
                        <th style="padding:8px 16px;text-align:left;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:0.1em">Ticker</th>
                        <th style="padding:8px 16px;text-align:left;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:0.1em">Sentiment</th>
                        <th style="padding:8px 16px;text-align:left;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:0.1em">Score</th>
                        <th style="padding:8px 16px;text-align:left;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:0.1em">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>{rows_html}</tbody>
                  </table>
                  <div style="margin-top:24px">
                    <a href="{config.FRONTEND_URL}/app"
                       style="display:inline-block;background:#22c55e;color:#000;font-size:11px;font-weight:700;
                              letter-spacing:0.15em;text-transform:uppercase;padding:10px 20px;text-decoration:none">
                      Open SentimentSignal \u2192
                    </a>
                  </div>
                </div>
                """
                send_email(user.email, "Your Weekly SentimentSignal Watchlist Digest", html)
                sent += 1
            except Exception as e:
                print(f"[digest] Failed for user {user.id}: {e}")

        print(f"[digest] Sent {sent} weekly digests")


def _weekly_digest_loop(app) -> None:
    """
    Runs send_watchlist_digests every Monday at 08:00 local time.
    Sleeps until the next Monday 08:00, fires, then repeats.
    """
    import datetime as dt
    while True:
        now = dt.datetime.now()
        # days_until_monday: 0 = today is Monday, positive = days ahead
        days_until_monday = (7 - now.weekday()) % 7
        next_monday = now.replace(hour=8, minute=0, second=0, microsecond=0) + dt.timedelta(days=days_until_monday)
        # If it's Monday but already past 08:00, schedule for next week
        if next_monday <= now:
            next_monday += dt.timedelta(days=7)
        sleep_seconds = (next_monday - now).total_seconds()
        print(f"[digest] next run scheduled for {next_monday.isoformat()} (in {sleep_seconds/3600:.1f}h)")
        time.sleep(sleep_seconds)
        try:
            send_watchlist_digests(app)
        except Exception as exc:
            print(f"[digest] unexpected error: {exc}")


def start(app, interval_minutes: int = 30) -> None:
    """
    Start all background scheduler threads (idempotent — safe to call multiple
    times; only the first call has any effect).
    """
    global _started
    with _lock:
        if _started:
            return
        _started = True

    # News ingestion thread
    interval_seconds = interval_minutes * 60
    thread = threading.Thread(
        target=_scheduler_loop,
        args=(app, interval_seconds),
        name="ss-scheduler",
        daemon=True,
    )
    thread.start()
    print(f"[scheduler] started — interval={interval_minutes}m, top_n=20")

    # Price alert check thread (every 15 minutes)
    alert_thread = threading.Thread(
        target=_price_alert_loop,
        args=(app, 15 * 60),
        name="ss-price-alerts",
        daemon=True,
    )
    alert_thread.start()
    print("[scheduler] price alert checker started — interval=15m")

    # Weekly digest thread (Mondays at 08:00)
    digest_thread = threading.Thread(
        target=_weekly_digest_loop,
        args=(app,),
        name="ss-weekly-digest",
        daemon=True,
    )
    digest_thread.start()
    print("[scheduler] weekly digest thread started — fires Mondays at 08:00")
