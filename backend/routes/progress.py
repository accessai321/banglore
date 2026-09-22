from flask import Blueprint, request, jsonify, g
from firebase_config import db
from middleware.auth_middleware import token_required
from middleware.validators import validate_progress
from services.mode_collections import (
    find_user_profile,
    migrate_legacy_progress,
    migrate_legacy_user_profile,
    progress_collection,
)
from datetime import datetime, timezone

progress_bp = Blueprint("progress", __name__)


# POST /progress  — protected
@progress_bp.route("/progress", methods=["POST"])
@token_required
def save_progress():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        error = validate_progress(data)
        if error:
            return jsonify({"error": error}), 400

        user_id   = data["userId"].strip()
        if g.uid != user_id:
            return jsonify({"error": "Unauthorized"}), 403

        migrate_legacy_user_profile(db, user_id)
        mode, user_doc = find_user_profile(db, user_id)
        if not user_doc or not user_doc.exists:
            return jsonify({"error": "User not found"}), 404
        migrate_legacy_progress(db, user_id, mode)

        course_id = data["courseId"].strip()
        doc_id    = f"{user_id}_{course_id}"

        progress_collection(db, mode).document(doc_id).set({
            "userId":     user_id,
            "courseId":   course_id,
            "completion": data["completion"],
            "disabilityType": mode,
            "updatedAt":  datetime.now(timezone.utc).isoformat(),
        }, merge=True)

        return jsonify({"message": "Progress saved successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# GET /progress/<userId>  — protected
@progress_bp.route("/progress/<user_id>", methods=["GET"])
@token_required
def get_progress(user_id):
    try:
        if g.uid != user_id:
            return jsonify({"error": "Unauthorized"}), 403

        migrate_legacy_user_profile(db, user_id)
        mode, user_doc = find_user_profile(db, user_id)
        if not user_doc or not user_doc.exists:
            return jsonify({"error": "User not found"}), 404
        migrate_legacy_progress(db, user_id, mode)

        docs   = progress_collection(db, mode).where("userId", "==", user_id).stream()
        result = [{"id": doc.id, **doc.to_dict()} for doc in docs]

        return jsonify({"progress": result}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
