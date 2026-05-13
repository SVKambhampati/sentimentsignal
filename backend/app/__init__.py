import os
import re
from datetime import timedelta

from flask import Flask
from flask_cors import CORS

from app.core import config


def create_app():
    config.log_config_status()

    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = config.DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = config.SECRET_KEY
    app.config["JWT_SECRET_KEY"] = config.JWT_SECRET_KEY

    # In production (HTTPS) cookies must be Secure; in dev HTTP is fine
    is_prod = os.getenv("FLASK_ENV", "development") == "production"

    app.config["JWT_TOKEN_LOCATION"]    = ["cookies"]
    app.config["JWT_COOKIE_SECURE"]     = is_prod
    app.config["JWT_COOKIE_SAMESITE"]   = "None" if is_prod else "Lax"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=30)

    # Allow local dev + any *.vercel.app deployment + optional FRONTEND_URL override.
    # Single compiled regex — flask-cors doesn't support mixed lists of strings + patterns.
    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    extra = (re.escape(frontend_url) + "|") if frontend_url else ""
    origin_pattern = re.compile(
        rf"^({extra}http://localhost:(5173|5174)|https://[^/]+\.vercel\.app)$"
    )
    print(f"[cors] origin pattern: {origin_pattern.pattern}")

    CORS(app, origins=origin_pattern, supports_credentials=True)

    from app.extensions import bcrypt, db, jwt

    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    from app.api.health import health_bp
    from app.api.news import news_bp
    from app.api.auth import auth_bp
    from app.api.stocks import stocks_bp
    from app.api.watchlist import watchlist_bp
    from app.api.discuss import discuss_bp
    from app.api.preferences import prefs_bp
    from app.api.users import users_bp
    from app.api.portfolio import portfolio_bp
    from app.api.alerts import alerts_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(news_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(stocks_bp, url_prefix="/api/stocks")
    app.register_blueprint(watchlist_bp, url_prefix="/api/watchlist")
    app.register_blueprint(discuss_bp, url_prefix="/api/discuss")
    app.register_blueprint(prefs_bp, url_prefix="/api/user")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(portfolio_bp, url_prefix="/api/portfolio")
    app.register_blueprint(alerts_bp, url_prefix="/api/alerts")

    with app.app_context():
        from app.db import models  # noqa: F401

        db.create_all()

    # Start background news-ingest scheduler (daemon thread, 30-min interval)
    from app.core.scheduler import start as scheduler_start
    scheduler_start(app, interval_minutes=30)

    return app
