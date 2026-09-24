# Real Human Sign-Language Video Library (/public/signs/)

This directory stores authentic prerecorded real-human sign language video clips used by **Nova**, the AI Sign Language Teacher in AccessAI.

## Video Specifications:
- **Format**: MP4 (H.264 video codec, AAC/no audio)
- **Framing**: Waist/chest upward.
- **Visibility**: Both hands, full face, and shoulders must remain completely visible throughout the clip.
- **Lighting**: Clean studio lighting with high contrast against a neutral/dark backdrop.
- **Speed**: Natural conversational pace, steady framing.

## Required Clip Index:
1. `hello.mp4` — Teacher signing "Hello / Welcome"
2. `yes.mp4` — Teacher signing "Yes / Confirmed"
3. `no.mp4` — Teacher signing "No / Not this"
4. `ok.mp4` — Teacher signing "OK / Understood"
5. `peace.mp4` — Teacher signing "Peace / Two"
6. `ily.mp4` — Teacher signing "I Love You (ASL)"
7. `courses.mp4` — Teacher signing "Okay, let's go to Courses"
8. `repeat.mp4` — Teacher demonstrating slow sign repetition
9. `excellent.mp4` — Teacher signing "Excellent! / Correct!" with affirming smile and praise
10. `try-again.mp4` — Teacher signing "Try again / Almost there" with encouraging facial expression

*Note: AccessAI's `<SignTeacher />` component automatically detects when `.mp4` clips are present in this folder and falls back gracefully to high-clarity sign reference demonstration cards if a file is pending upload.*
