from flask import Blueprint, request, jsonify
from firebase_admin import auth, firestore
from firebase_config import db
from middleware.validators import validate_register, validate_login
from services.mode_collections import (
    find_user_profile,
    migrate_legacy_user_profile,
    normalize_mode,
    users_collection,
)
from datetime import datetime, timezone

auth_bp = Blueprint("auth", __name__)


# POST /register
@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        error = validate_register(data)
        if error:
            return jsonify({"error": error}), 400

        decoded = auth.verify_id_token(data["idToken"])
        uid = decoded["uid"]
        email = decoded.get("email", data["email"]).strip()

        auth.update_user(
            uid,
            display_name=data["name"].strip(),
        )

        disability_type = normalize_mode(data["disabilityType"])

        user_data = {
            "name":           data["name"].strip(),
            "email":          email,
            "disabilityType": disability_type,
            "createdAt":      datetime.now(timezone.utc).isoformat(),
        }
        if "firstName" in data:
            user_data["firstName"] = data["firstName"].strip()
        if "lastName" in data:
            user_data["lastName"] = data["lastName"].strip()
        if "phone" in data:
            user_data["phone"] = data["phone"].strip()
        if "age" in data:
            user_data["age"] = data["age"]
        if "gender" in data:
            user_data["gender"] = data["gender"].strip()

        auth.set_custom_user_claims(uid, {"disabilityType": disability_type})
        users_collection(db, disability_type).document(uid).set(user_data)

        return jsonify({"message": "User registered", "uid": uid}), 201

    except auth.EmailAlreadyExistsError:
        return jsonify({"error": "Email already in use"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# POST /login
@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        error = validate_login(data)
        if error:
            return jsonify({"error": error}), 400

        decoded  = auth.verify_id_token(data["idToken"])
        uid      = decoded["uid"]
        email    = decoded.get("email", "")

        migrate_legacy_user_profile(db, uid)
        mode, user_doc = find_user_profile(db, uid)
        profile = user_doc.to_dict() if user_doc and user_doc.exists else {}
        if profile and mode:
            profile["disabilityType"] = mode

        return jsonify({
            "message": "Login successful",
            "uid":     uid,
            "email":   email,
            "profile": profile,
        }), 200

    except auth.ExpiredIdTokenError:
        return jsonify({"error": "Token has expired. Please log in again."}), 401
    except auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
