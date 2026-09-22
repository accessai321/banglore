import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path

# Initialize Firebase
service_account_path = Path(__file__).resolve().parent / "serviceAccountKey.json"

if not firebase_admin._apps:
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

courses = [
    {
        "title": "American Sign Language Alphabet",
        "description": "Learn to spell your name and master the basic letters (A-Z) in American Sign Language.",
        "video": "5K69_tq-0pQ",
        "audio": "",
        "category": "language"
    },
    {
        "title": "Basic ASL Sentences & Greetings",
        "description": "Essential greetings, common expressions, and simple conversational starters in sign language.",
        "video": "ianCxd71Uzg",
        "audio": "",
        "category": "language"
    },
    {
        "title": "Sign Language: Numbers & Colors",
        "description": "Learn the fundamentals of counting, expressions, and identifying colors in ASL.",
        "video": "Raa0IvPnPhg",
        "audio": "",
        "category": "language"
    },
    {
        "title": "Advanced Conversational Sign Language",
        "description": "Improve your signing speed, sentence syntax, and understand advanced non-manual markers.",
        "video": "0FcwzLiXpNY",
        "audio": "",
        "category": "language"
    },
    {
        "title": "Introduction to Python",
        "description": "Learn the fundamentals of Python programming, including variables, loops, and functions with motor-adaptive code editors.",
        "video": "rfscVS0vtbw",
        "audio": "",
        "category": "programming"
    },
    {
        "title": "Java Programming Basics",
        "description": "Master object-oriented programming in Java. Build robust console applications using adaptive switch selectors.",
        "video": "A74TOX803D0",
        "audio": "",
        "category": "programming"
    },
    {
        "title": "Database Management & SQL",
        "description": "Learn to design relational databases, write SQL queries, and manage database records with structured tables.",
        "video": "Dl8a13w4G90",
        "audio": "",
        "category": "programming"
    },
    {
        "title": "Web Development Basics",
        "description": "Build responsive websites using modern HTML, CSS, and interactive JavaScript interfaces.",
        "video": "0FcwzLiXpNY",
        "audio": "",
        "category": "programming"
    }
]

print("Seeding courses to Firestore...")
for c in courses:
    try:
        # Check if course already exists by title
        docs = db.collection("courses").where("title", "==", c["title"]).stream()
        exists = any(docs)
        if not exists:
            db.collection("courses").add(c)
            print(f"Added course: {c['title']}")
        else:
            print(f"Course already exists: {c['title']}")
    except Exception as e:
        print(f"Error adding course {c['title']}: {e}")

print("Seeding complete!")
