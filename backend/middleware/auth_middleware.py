from functools import wraps
from flask import request, jsonify, g
from firebase_admin import auth


def token_required(f):
    """
    Decorator that verifies the Firebase ID token sent in the
    Authorization header.

    Usage:
        @some_bp.route("/protected")
        @token_required
        def protected_route():
            uid = g.uid          # verified user ID
            email = g.email      # verified email
            ...

    Expected header:
        Authorization: Bearer <Firebase ID token>
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        id_token = auth_header.split("Bearer ")[1].strip()

        if not id_token:
            return jsonify({"error": "Token is empty"}), 401

        try:
            decoded = auth.verify_id_token(id_token)
            # Store decoded info in Flask's request context (g)
            g.uid   = decoded["uid"]
            g.email = decoded.get("email", "")
        except auth.ExpiredIdTokenError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401
        except auth.InvalidIdTokenError:
            return jsonify({"error": "Invalid token. Please log in again."}), 401
        except Exception as e:
            return jsonify({"error": f"Token verification failed: {str(e)}"}), 401

        return f(*args, **kwargs)
    return decorated