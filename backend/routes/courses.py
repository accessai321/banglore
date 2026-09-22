from flask import Blueprint, request, jsonify
from firebase_config import db
from middleware.auth_middleware import token_required
from middleware.validators import validate_course

course_bp = Blueprint("courses", __name__)


# GET /courses  — public
@course_bp.route("/courses", methods=["GET"])
def get_courses():
    try:
        docs   = db.collection("courses").stream()
        result = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        return jsonify({"courses": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# POST /courses  — protected
@course_bp.route("/courses", methods=["POST"])
@token_required
def add_course():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        error = validate_course(data)
        if error:
            return jsonify({"error": error}), 400

        course_data = {
            "title":       data["title"].strip(),
            "description": data["description"].strip(),
            "video":       data["video"].strip(),
            "audio":       data["audio"].strip(),
            "category":    data["category"].strip().lower(),
        }

        doc_ref = db.collection("courses").add(course_data)
        return jsonify({"message": "Course added successfully", "courseId": doc_ref[1].id}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500