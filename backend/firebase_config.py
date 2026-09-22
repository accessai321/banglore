import os
import json
import firebase_admin
from firebase_admin import credentials, firestore, auth
from pathlib import Path

# Initialize Firebase Admin SDK (only once)
if not firebase_admin._apps:
    env_service_key = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
    service_account_path = Path(__file__).resolve().parent / "serviceAccountKey.json"

    if env_service_key:
        try:
            cred_dict = json.loads(env_service_key)
            cred = credentials.Certificate(cred_dict)
        except Exception:
            cred = credentials.Certificate(env_service_key)
    elif service_account_path.exists():
        cred = credentials.Certificate(str(service_account_path))
    else:
        try:
            cred = credentials.ApplicationDefault()
        except Exception as e:
            print("Warning: No Firebase credentials found. Provide serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT_KEY env var.", e)
            cred = None

    if cred:
        firebase_admin.initialize_app(cred)

# Firestore client
try:
    db = firestore.client()
except Exception as e:
    print("Warning: Firestore client not initialized:", e)
    db = None
