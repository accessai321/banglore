ALLOWED_MODES = {"motor", "blind", "deaf", "none"}

MODE_USER_COLLECTIONS = {
    "motor": "motor_users",
    "blind": "blind_users",
    "deaf": "deaf_users",
    "none": "general_users",
}

MODE_PROGRESS_COLLECTIONS = {
    "motor": "motor_progress",
    "blind": "blind_progress",
    "deaf": "deaf_progress",
    "none": "general_progress",
}

LEGACY_USERS_COLLECTION = "users"
LEGACY_PROGRESS_COLLECTION = "progress"


def normalize_mode(value):
    mode = str(value or "").strip().lower()
    if mode not in ALLOWED_MODES:
        raise ValueError(f"disabilityType must be one of: {', '.join(sorted(ALLOWED_MODES))}")
    return mode


def users_collection(db, mode):
    return db.collection(MODE_USER_COLLECTIONS[normalize_mode(mode)])


def progress_collection(db, mode):
    return db.collection(MODE_PROGRESS_COLLECTIONS[normalize_mode(mode)])


def find_user_profile(db, uid):
    for mode, collection_name in MODE_USER_COLLECTIONS.items():
        doc = db.collection(collection_name).document(uid).get()
        if doc.exists:
            profile = doc.to_dict()
            profile["disabilityType"] = normalize_mode(profile.get("disabilityType", mode))
            return mode, doc

    legacy_doc = db.collection(LEGACY_USERS_COLLECTION).document(uid).get()
    if legacy_doc.exists:
        profile = legacy_doc.to_dict()
        mode = normalize_mode(profile.get("disabilityType", "none"))
        return mode, legacy_doc

    return None, None


def migrate_legacy_user_profile(db, uid):
    legacy_ref = db.collection(LEGACY_USERS_COLLECTION).document(uid)
    legacy_doc = legacy_ref.get()
    if not legacy_doc.exists:
        return None

    profile = legacy_doc.to_dict()
    mode = normalize_mode(profile.get("disabilityType", "none"))
    profile["disabilityType"] = mode
    users_collection(db, mode).document(uid).set(profile, merge=True)
    legacy_ref.delete()
    return mode


def migrate_legacy_progress(db, uid, mode):
    migrated = 0
    docs = db.collection(LEGACY_PROGRESS_COLLECTION).where("userId", "==", uid).stream()
    for doc in docs:
        progress_data = doc.to_dict()
        progress_data["disabilityType"] = normalize_mode(mode)
        progress_collection(db, mode).document(doc.id).set(progress_data, merge=True)
        doc.reference.delete()
        migrated += 1
    return migrated
