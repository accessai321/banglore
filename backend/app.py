from flask import Flask, jsonify
from flask_cors import CORS
from routes.auth import auth_bp
from routes.courses import course_bp
from routes.progress import progress_bp
from routes.users import users_bp

app = Flask(__name__)
CORS(app)

# Register Blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(course_bp)
app.register_blueprint(progress_bp)
app.register_blueprint(users_bp)


# ── Global error handlers ───────────────────────────────────────────────────────

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad request", "details": str(e)}), 400

@app.errorhandler(401)
def unauthorized(e):
    return jsonify({"error": "Unauthorized"}), 401

@app.errorhandler(403)
def forbidden(e):
    return jsonify({"error": "Forbidden"}), 403

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500


# ── Health check ────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return jsonify({"message": "AccessAI backend running"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)