# FaceLivenessPAD

Simple prototype for a college/hackathon demonstration.

## Project flow

Camera
  ↓
Face Detection
  ↓
30-frame Video Sequence
  ↓
Passive Liveness
  - Face landmarks
  - Temporal motion
  - Optical flow
  - Facial geometry
  - Texture
  - Head movement
  - Motion consistency
  ↓
PAD Check
  ↓
If needed / demonstration → Active Liveness
  - Blink
  - Smile
  - Turn head left/right
  ↓
Final Result
  LIVE / SPOOF

## Important note

The included PAD is a lightweight computer-vision heuristic. It is not a
trained anti-spoofing model and should not be presented as production-grade
biometric security. It is intended to demonstrate the architecture and the
features suggested for the project. A trained PAD model can be integrated
later without changing the overall flow.

## Windows setup

Use Python 3.12.

Open a terminal in this folder and run:

    python -m pip install -r requirements.txt

Then:

    python main.py

Controls:
    Q = quit
    R = reset 30-frame analysis
    C = move to the next active challenge

## If the camera does not open

Close Teams, Zoom, WhatsApp, Camera, browser camera tabs, or other programs
using the webcam and run the program again.

## Current scope

This version intentionally does not include:
- registration/database
- Android application
- operator/supervisor authentication
- custom model training
- large datasets

Those can be added later if required.
