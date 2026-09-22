from flask import Blueprint, request, jsonify, g
from firebase_admin import auth
from firebase_config import db
from middleware.auth_middleware import token_required
from middleware.validators import validate_user_update
from services.mode_collections import (
    find_user_profile,
    migrate_legacy_user_profile,
    normalize_mode,
    users_collection,
)
from datetime import datetime, timezone

users_bp = Blueprint("users", __name__)


# GET /users/<userId>  — protected
@users_bp.route("/users/<user_id>", methods=["GET"])
@token_required
def get_user(user_id):
    try:
        # Users can only fetch their own profile
        if g.uid != user_id:
            return jsonify({"error": "Unauthorized"}), 403

        migrate_legacy_user_profile(db, user_id)
        mode, doc = find_user_profile(db, user_id)
        if not doc or not doc.exists:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"user": {"uid": doc.id, **doc.to_dict()}}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# PUT /users/<userId>  — protected
@users_bp.route("/users/<user_id>", methods=["PUT"])
@token_required
def update_user(user_id):
    try:
        if g.uid != user_id:
            return jsonify({"error": "Unauthorized"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        error = validate_user_update(data)
        if error:
            return jsonify({"error": error}), 400

        migrate_legacy_user_profile(db, user_id)
        current_mode, doc = find_user_profile(db, user_id)
        if not doc or not doc.exists:
            return jsonify({"error": "User not found"}), 404

        allowed = {"name", "disabilityType"}
        updates = {k: v for k, v in data.items() if k in allowed}
        if "disabilityType" in updates:
            updates["disabilityType"] = normalize_mode(updates["disabilityType"])
        updates["updatedAt"] = datetime.now(timezone.utc).isoformat()

        next_mode = updates.get("disabilityType", current_mode)
        if next_mode != current_mode:
            user_data = doc.to_dict()
            user_data.update(updates)
            users_collection(db, next_mode).document(user_id).set(user_data)
            users_collection(db, current_mode).document(user_id).delete()
            auth.set_custom_user_claims(user_id, {"disabilityType": next_mode})
        else:
            users_collection(db, current_mode).document(user_id).update(updates)

        if "name" in updates:
            auth.update_user(user_id, display_name=updates["name"])

        return jsonify({"message": "User updated successfully"}), 200

    except auth.UserNotFoundError:
        return jsonify({"error": "Firebase Auth user not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# DELETE /users/<userId>  — protected
@users_bp.route("/users/<user_id>", methods=["DELETE"])
@token_required
def delete_user(user_id):
    try:
        if g.uid != user_id:
            return jsonify({"error": "Unauthorized"}), 403

        migrate_legacy_user_profile(db, user_id)
        mode, doc = find_user_profile(db, user_id)
        if not doc or not doc.exists:
            return jsonify({"error": "User not found"}), 404

        users_collection(db, mode).document(user_id).delete()
        auth.delete_user(user_id)

        return jsonify({"message": "User deleted successfully"}), 200

    except auth.UserNotFoundError:
        return jsonify({"message": "User deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
