import threading
from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.route("/health")
def health_check():
    return jsonify(status="ok")


@health_bp.route("/api/admin/seed", methods=["POST"])
def seed_data():
    """
    Trigger an immediate news-ingestion run for the default seed tickers.
    Call this once after a fresh deployment to populate the database.

    POST /api/admin/seed
    Returns immediately — ingestion runs in a background thread.
    """
    from app import create_app as _get_app
    from flask import current_app
    from app.core.scheduler import DEFAULT_SEED_TICKERS
    from app.services.news.pipeline import ingest_news_for_ticker
    from app.services.sentiment import snapshot_ticker
    from app.core.cache import delete as cache_delete

    app = current_app._get_current_object()

    def _run():
        with app.app_context():
            print("[seed] manual seed triggered")
            ok = 0
            for ticker in DEFAULT_SEED_TICKERS:
                try:
                    articles = ingest_news_for_ticker(ticker, days=7)
                    print(f"[seed]   {ticker}: +{len(articles)} articles")
                    try:
                        snapshot_ticker(ticker)
                    except Exception as snap_err:
                        print(f"[seed]   {ticker}: snapshot error — {snap_err}")
                    ok += 1
                except Exception as e:
                    print(f"[seed]   {ticker}: error — {e}")
            for key in ("feed", "trending", "shifters", "market-summary"):
                cache_delete(key)
            print(f"[seed] done — {ok}/{len(DEFAULT_SEED_TICKERS)} tickers ingested")

    t = threading.Thread(target=_run, daemon=True, name="ss-manual-seed")
    t.start()

    return jsonify({
        "status": "started",
        "tickers": DEFAULT_SEED_TICKERS,
        "message": "Ingestion running in background. Check backend logs for progress.",
    })
