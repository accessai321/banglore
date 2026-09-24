from flask import Blueprint, request, jsonify
from firebase_config import db
from middleware.auth_middleware import token_required
from middleware.validators import validate_course

course_bp = Blueprint("courses", __name__)


# GET /courses  — public
@course_bp.route("/courses", methods=["GET"])
def get_courses():
    try:
        if db:
            docs   = db.collection("courses").stream()
            result = [{"id": doc.id, **doc.to_dict()} for doc in docs]
            if result:
                return jsonify({"courses": result}), 200
        
        # Local deaf-accessible course catalog fallback
        fallback_courses = [
            {
                "id": "course-1",
                "title": "American Sign Language Alphabet",
                "description": "Learn to spell your name and master the basic letters (A-Z) in American Sign Language.",
                "video": "DBQINq0SsAw",
                "category": "language",
                "instructor": "Sarah Jenkins, ASL Specialist",
                "duration": "1h 15m",
                "level": "Beginner"
            },
            {
                "id": "course-2",
                "title": "Basic ASL Sentences & Greetings",
                "description": "Essential greetings, common expressions, and simple conversational starters in sign language.",
                "video": "nJx-XsxeajQ",
                "category": "language",
                "instructor": "Sarah Jenkins, ASL Specialist",
                "duration": "2h 30m",
                "level": "Beginner"
            },
            {
                "id": "course-3",
                "title": "Sign Language: Numbers & Colors",
                "description": "Learn the fundamentals of counting, expressions, and identifying colors in ASL.",
                "video": "v1desDduz5M",
                "category": "vocabulary",
                "instructor": "David Vance, Deaf Educator",
                "duration": "1h 45m",
                "level": "Intermediate"
            }
        ]
        return jsonify({"courses": fallback_courses}), 200
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