import firebase_admin
from firebase_admin import credentials, firestore, auth
from pathlib import Path

# Initialize Firebase Admin SDK (only once)
if not firebase_admin._apps:
    service_account_path = Path(__file__).resolve().parent / "serviceAccountKey.json"
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)

# Firestore client
db = firestore.client()
