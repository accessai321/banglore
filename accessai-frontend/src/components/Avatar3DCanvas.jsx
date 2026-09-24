import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * 3D WebGL Avatar Canvas using Three.js
 * "Nova" - Realistic Human-Like Virtual AI Assistant
 * 
 * Features:
 * - Anatomically sculpted human cranium, jawline, nose, lips, ears, and neck.
 * - Photorealistic dual-layer eyes (sclera, iris, pupil, glossy reflective cornea) with micro-saccades.
 * - Layered volumetric modern hairstyle with realistic sheen.
 * - Articulated 5-digit human hands with realistic sign language finger poses (Point, Thumbs Up, Peace, ILY, Wave, ASL).
 * - Real-time speech visemes and natural eyelid blink cycles.
 * - Organic breathing and idle posture shifts.
 * - Hybrid Architecture: Procedural 3D human by default + GLTFLoader for Ready Player Me / custom .glb models.
 */
export default function Avatar3DCanvas({
  avatarAction = "idle", // 'idle' | 'wave' | 'point_courses' | 'nod' | 'thumbs_up' | 'sign_asl' | 'speaking' | 'peace' | 'ily'
  isSpeaking = false,
  status = "ready", // 'ready' | 'detecting' | 'executed'
  modelUrl = null, // Optional Ready Player Me or custom .glb URL
  className = "w-full h-full"
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const characterRef = useRef(null);
  const animStateRef = useRef({
    time: 0,
    action: avatarAction,
    isSpeaking: isSpeaking,
    actionStartTime: 0,
    blinkProgress: 0,
    isBlinking: false,
    nextBlinkTime: 2.5,
    gazeX: 0,
    gazeY: 0,
    nextGazeTime: 2.0
  });

  // Keep animState updated without re-initializing Three.js scene
  useEffect(() => {
    animStateRef.current.action = avatarAction;
    animStateRef.current.isSpeaking = isSpeaking;
    animStateRef.current.actionStartTime = animStateRef.current.time;
  }, [avatarAction, isSpeaking]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 340;

    // ── 1. Scene & Camera ──────────────────────────────────
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.32, 2.7);
    camera.lookAt(0, 1.25, 0);

    // ── 2. WebGL Renderer with Soft Shadows ────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // ── 3. Three-Point Studio Lighting + Futuristic Rim ────
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.4);
    scene.add(ambientLight);

    // Key Light (Warm daylight)
    const keyLight = new THREE.DirectionalLight(0xfffaf0, 2.2);
    keyLight.position.set(1.5, 3.5, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Fill Light (Soft cool contrast)
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    fillLight.position.set(-2, 2, 2);
    scene.add(fillLight);

    // Rim / Hair Light (Vibrant cyan rim for modern tech aura)
    const rimLight = new THREE.PointLight(0x06b6d4, 3.0, 8);
    rimLight.position.set(0, 2.8, -1.8);
    scene.add(rimLight);

    // Subtle floating dust/particles for depth
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 35;
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 3.5;
      posArray[i + 1] = Math.random() * 2.8;
      posArray[i + 2] = (Math.random() - 0.5) * 2.5;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.035,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ── 4. Character Container & PBR Materials ──────────────
    const character = new THREE.Group();
    scene.add(character);

    // Human Skin PBR Material (Soft warm tone with subsurface roughness)
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf3c7aa,
      roughness: 0.55,
      metalness: 0.04
    });

    const skinShadowMat = new THREE.MeshStandardMaterial({
      color: 0xe2ad8e,
      roughness: 0.6,
      metalness: 0.04
    });

    // Natural Human Lips Material (Moist slight sheen)
    const lipsMat = new THREE.MeshStandardMaterial({
      color: 0xd9777f,
      roughness: 0.38,
      metalness: 0.08
    });

    // Rich Dark Hair Material with soft anisotropic sheen
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x271e1b,
      roughness: 0.42,
      metalness: 0.12
    });

    // Sleek Modern Blazer / Suit Material
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.65,
      metalness: 0.2
    });

    // Inner Tech Shirt Material
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.15
    });

    // AI Cyan Emblem Material
    const neonCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00d2b4,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });

    // Eyes Materials
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xfcfcfc });
    const irisMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Vibrant deep cyan-blue iris
      roughness: 0.25,
      metalness: 0.15
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x080808 });
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.92,
      opacity: 1,
      transparent: true,
      roughness: 0.03,
      ior: 1.34
    });
    const eyelashMat = new THREE.MeshBasicMaterial({ color: 0x1a1210 });

    // ── 5. Anatomically Sculpted Humanoid Nova ──────────────

    // --- Torso & Clothing ---
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 0.5;
    character.add(torsoGroup);

    // Blazer Chest & Torso (Curved natural taper)
    const chestGeo = new THREE.CylinderGeometry(0.36, 0.44, 0.85, 20);
    chestGeo.scale(1.15, 1, 0.82); // Broader shoulders, flatter front-to-back
    const chest = new THREE.Mesh(chestGeo, suitMat);
    chest.position.y = 0.05;
    chest.castShadow = true;
    chest.receiveShadow = true;
    torsoGroup.add(chest);

    // Inner Tech Shirt / V-Neck insert
    const shirtGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.65, 16);
    shirtGeo.scale(1.05, 1, 0.84);
    const shirt = new THREE.Mesh(shirtGeo, shirtMat);
    shirt.position.set(0, 0.18, 0.02);
    torsoGroup.add(shirt);

    // Suit Lapel Collars (Left & Right)
    const leftLapel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.05), suitMat);
    leftLapel.position.set(-0.16, 0.28, 0.32);
    leftLapel.rotation.set(0.15, 0.1, -0.35);
    torsoGroup.add(leftLapel);

    const rightLapel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.05), suitMat);
    rightLapel.position.set(0.16, 0.28, 0.32);
    rightLapel.rotation.set(0.15, -0.1, 0.35);
    torsoGroup.add(rightLapel);

    // Subtle AI Nova Smart Badge on Left Chest
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16), neonCyanMat);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(-0.22, 0.32, 0.33);
    torsoGroup.add(badge);

    // --- Sculpted Neck & Throat ---
    const neckGroup = new THREE.Group();
    neckGroup.position.y = 0.94;
    character.add(neckGroup);

    const neckGeo = new THREE.CylinderGeometry(0.11, 0.135, 0.24, 20);
    neckGeo.scale(0.95, 1, 1.05);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = 0.08;
    neckGroup.add(neck);

    // --- Sculpted Human Head Group ---
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.25;
    character.add(headGroup);

    // Cranium / Upper Skull
    const craniumGeo = new THREE.SphereGeometry(0.31, 32, 24);
    craniumGeo.scale(0.92, 1.08, 1.02);
    const cranium = new THREE.Mesh(craniumGeo, skinMat);
    cranium.position.set(0, 0.05, -0.01);
    headGroup.add(cranium);

    // Sculpted Mandible / Jaw & Chin
    const jawGeo = new THREE.ConeGeometry(0.24, 0.32, 16);
    jawGeo.scale(1.05, 1, 0.95);
    jawGeo.rotateX(Math.PI);
    const jaw = new THREE.Mesh(jawGeo, skinMat);
    jaw.position.set(0, -0.14, 0.04);
    headGroup.add(jaw);

    // Rounded Chin
    const chinGeo = new THREE.SphereGeometry(0.08, 16, 16);
    chinGeo.scale(1.1, 0.85, 1);
    const chin = new THREE.Mesh(chinGeo, skinMat);
    chin.position.set(0, -0.25, 0.17);
    headGroup.add(chin);

    // Zygomatic Cheek Contours (Cheekbones)
    const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), skinMat);
    leftCheek.scale.set(0.9, 0.9, 1.2);
    leftCheek.position.set(-0.16, -0.02, 0.16);
    headGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), skinMat);
    rightCheek.scale.set(0.9, 0.9, 1.2);
    rightCheek.position.set(0.16, -0.02, 0.16);
    headGroup.add(rightCheek);

    // --- 3D Sculpted Nose ---
    const noseGroup = new THREE.Group();
    noseGroup.position.set(0, 0.01, 0.28);
    headGroup.add(noseGroup);

    // Nose Bridge (Dorsum)
    const noseBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.15, 12), skinMat);
    noseBridge.rotation.x = 0.25;
    noseBridge.position.set(0, 0.02, 0.015);
    noseGroup.add(noseBridge);

    // Nose Tip
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 16), skinMat);
    noseTip.position.set(0, -0.05, 0.04);
    noseGroup.add(noseTip);

    // Nostril Wings (Alae)
    const leftNostril = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), skinShadowMat);
    leftNostril.position.set(-0.038, -0.055, 0.02);
    const rightNostril = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), skinShadowMat);
    rightNostril.position.set(0.038, -0.055, 0.02);
    noseGroup.add(leftNostril, rightNostril);

    // --- Sculpted Ears ---
    const createEar = (isLeft) => {
      const earGroup = new THREE.Group();
      const earHelix = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16, Math.PI * 1.2), skinMat);
      earHelix.rotation.z = isLeft ? 0.3 : -0.3;
      const earLobe = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), skinMat);
      earLobe.scale.set(0.8, 1.3, 0.7);
      earLobe.position.set(0, -0.06, 0);
      earGroup.add(earHelix, earLobe);
      earGroup.position.set(isLeft ? -0.28 : 0.28, 0.04, -0.02);
      earGroup.rotation.y = isLeft ? -0.2 : 0.2;
      return earGroup;
    };
    headGroup.add(createEar(true));
    headGroup.add(createEar(false));

    // --- Photorealistic Human Eyes with Corneal Specular Highlights ---
    const eyesContainer = new THREE.Group();
    headGroup.add(eyesContainer);

    const createHumanEye = (isLeft) => {
      const eyeRig = new THREE.Group();
      eyeRig.position.set(isLeft ? -0.11 : 0.11, 0.07, 0.26);

      // Eye Globe (Sclera)
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 20), scleraMat);
      eyeRig.add(globe);

      // Gaze Tracker Subgroup (Pupil + Iris + Cornea)
      const gazeGroup = new THREE.Group();

      // Iris with rich colored depth
      const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 24), irisMat);
      iris.rotation.x = Math.PI / 2;
      iris.position.z = 0.052;
      gazeGroup.add(iris);

      // Pupil
      const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.009, 16), pupilMat);
      pupil.rotation.x = Math.PI / 2;
      pupil.position.z = 0.053;
      gazeGroup.add(pupil);

      // Glossy Reflective Cornea Dome (High Specular Eye Reflection)
      const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), corneaMat);
      cornea.position.z = 0.038;
      gazeGroup.add(cornea);

      eyeRig.add(gazeGroup);

      // Eyelashes & Brow Contour
      const eyelash = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.006, 6, 16, Math.PI * 0.8), eyelashMat);
      eyelash.position.set(0, 0.015, 0.035);
      eyelash.rotation.x = 0.2;
      eyelash.rotation.z = isLeft ? 0.1 : -0.1;
      eyeRig.add(eyelash);

      // Natural Upper Eyelid for Realistic Blinking
      const eyelid = new THREE.Mesh(new THREE.SphereGeometry(0.058, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), skinMat);
      eyelid.rotation.x = Math.PI;
      eyelid.position.z = 0.005;
      eyelid.scale.set(1, 0, 1); // 0 = open, 1 = fully closed
      eyeRig.add(eyelid);

      return { eyeRig, gazeGroup, eyelid };
    };

    const leftEyeComponents = createHumanEye(true);
    const rightEyeComponents = createHumanEye(false);
    eyesContainer.add(leftEyeComponents.eyeRig);
    eyesContainer.add(rightEyeComponents.eyeRig);

    // Natural Arched Eyebrows
    const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.02), hairMat);
    leftBrow.position.set(-0.115, 0.155, 0.285);
    leftBrow.rotation.set(-0.1, 0.1, -0.15);
    headGroup.add(leftBrow);

    const rightBrow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.02), hairMat);
    rightBrow.position.set(0.115, 0.155, 0.285);
    rightBrow.rotation.set(-0.1, -0.1, 0.15);
    headGroup.add(rightBrow);

    // --- Sculpted Human Lips & Viseme Morph Mouth ---
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.15, 0.265);
    headGroup.add(mouthGroup);

    // Upper Lip with Cupid's bow contour
    const upperLip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.08, 12), lipsMat);
    upperLip.rotation.z = Math.PI / 2;
    upperLip.position.set(0, 0.012, 0.02);
    upperLip.scale.set(1, 0.7, 0.7);
    mouthGroup.add(upperLip);

    // Lower Lip (Natural fullness)
    const lowerLip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.075, 12), lipsMat);
    lowerLip.rotation.z = Math.PI / 2;
    lowerLip.position.set(0, -0.018, 0.018);
    lowerLip.scale.set(1, 0.8, 0.8);
    mouthGroup.add(lowerLip);

    // Mouth Interior Cavity & Subtle Teeth Hint
    const mouthInterior = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshBasicMaterial({ color: 0x2d0a0a }));
    mouthInterior.position.set(0, -0.003, 0.005);
    mouthGroup.add(mouthInterior);

    const teethStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    teethStrip.position.set(0, 0.005, 0.006);
    mouthGroup.add(teethStrip);

    // --- Modern Volumetric Layered Hairstyle ---
    const hairGroup = new THREE.Group();
    headGroup.add(hairGroup);

    // Crown Volume
    const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 20), hairMat);
    hairCrown.scale.set(0.97, 1.05, 1.12);
    hairCrown.position.set(0, 0.12, -0.05);
    hairGroup.add(hairCrown);

    // Swept Forehead Bangs / Modern Fringe
    const bang1 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), hairMat);
    bang1.rotation.set(-1.1, -0.4, 0.8);
    bang1.position.set(-0.08, 0.22, 0.24);
    const bang2 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 8), hairMat);
    bang2.rotation.set(-1.2, 0.3, -0.6);
    bang2.position.set(0.09, 0.23, 0.23);
    hairGroup.add(bang1, bang2);

    // Side Temple Locks
    const leftLock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.28, 8), hairMat);
    leftLock.position.set(-0.27, 0.02, 0.08);
    leftLock.rotation.z = -0.2;
    const rightLock = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.28, 8), hairMat);
    rightLock.position.set(0.27, 0.02, 0.08);
    rightLock.rotation.z = 0.2;
    hairGroup.add(leftLock, rightLock);

    // ── 6. Articulated Human Arms & 5-Digit Signing Hands ──

    const createArticulatedHand = (isLeft) => {
      const handGroup = new THREE.Group();

      // Palm base with ergonomic contour
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.038), skinMat);
      palm.position.y = -0.055;
      handGroup.add(palm);

      // Thenar Eminence (Thumb muscle pad)
      const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 12), skinMat);
      thenar.position.set(isLeft ? 0.038 : -0.038, -0.04, 0.015);
      handGroup.add(thenar);

      // Helper to build articulated 2-segment finger
      const createFinger = (xOffset, length, thickness, angle = 0) => {
        const fingerRoot = new THREE.Group();
        fingerRoot.position.set(xOffset, -0.11, 0);
        fingerRoot.rotation.z = angle;

        // Proximal segment (Knuckle to mid)
        const proximal = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness * 0.9, length * 0.55, 8), skinMat);
        proximal.position.y = -length * 0.28;
        fingerRoot.add(proximal);

        // Distal segment (Mid to fingertip)
        const distalGroup = new THREE.Group();
        distalGroup.position.y = -length * 0.55;
        fingerRoot.add(distalGroup);

        const distal = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.9, thickness * 0.75, length * 0.45, 8), skinMat);
        distal.position.y = -length * 0.22;
        const fingertip = new THREE.Mesh(new THREE.SphereGeometry(thickness * 0.75, 8, 8), skinMat);
        fingertip.position.y = -length * 0.45;

        distalGroup.add(distal, fingertip);

        return { fingerRoot, distalGroup };
      };

      // 5 Realistic Human Fingers
      // 1. Thumb (Angled out)
      const thumbRoot = new THREE.Group();
      thumbRoot.position.set(isLeft ? 0.045 : -0.045, -0.045, 0.01);
      thumbRoot.rotation.set(0.3, isLeft ? -0.4 : 0.4, isLeft ? 0.6 : -0.6);
      const thumbProximal = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.048, 8), skinMat);
      thumbProximal.position.y = -0.024;
      thumbRoot.add(thumbProximal);
      const thumbDistalGroup = new THREE.Group();
      thumbDistalGroup.position.y = -0.048;
      const thumbDistal = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.042, 8), skinMat);
      thumbDistal.position.y = -0.021;
      thumbDistalGroup.add(thumbDistal);
      thumbRoot.add(thumbDistalGroup);
      handGroup.add(thumbRoot);

      // 2. Index Finger
      const indexFinger = createFinger(isLeft ? 0.03 : -0.03, 0.09, 0.015, isLeft ? 0.04 : -0.04);
      handGroup.add(indexFinger.fingerRoot);

      // 3. Middle Finger (Longest)
      const middleFinger = createFinger(isLeft ? 0.01 : -0.01, 0.10, 0.0155, 0);
      handGroup.add(middleFinger.fingerRoot);

      // 4. Ring Finger
      const ringFinger = createFinger(isLeft ? -0.012 : 0.012, 0.092, 0.0145, isLeft ? -0.03 : 0.03);
      handGroup.add(ringFinger.fingerRoot);

      // 5. Pinky Finger (Smallest)
      const pinkyFinger = createFinger(isLeft ? -0.032 : 0.032, 0.075, 0.013, isLeft ? -0.07 : 0.07);
      handGroup.add(pinkyFinger.fingerRoot);

      return {
        handGroup,
        thumb: { root: thumbRoot, distal: thumbDistalGroup },
        index: indexFinger,
        middle: middleFinger,
        ring: ringFinger,
        pinky: pinkyFinger
      };
    };

    // Build Left Arm Hierarchy
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(-0.46, 0.82, 0);
    character.add(leftShoulder);

    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.36, 16), suitMat);
    leftUpperArm.position.y = -0.18;
    leftShoulder.add(leftUpperArm);

    const leftElbow = new THREE.Group();
    leftElbow.position.y = -0.36;
    leftShoulder.add(leftElbow);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.32, 16), skinMat);
    leftForearm.position.y = -0.16;
    leftElbow.add(leftForearm);

    const leftWrist = new THREE.Group();
    leftWrist.position.y = -0.32;
    leftElbow.add(leftWrist);
    const leftHandRig = createArticulatedHand(true);
    leftWrist.add(leftHandRig.handGroup);

    // Build Right Arm Hierarchy
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(0.46, 0.82, 0);
    character.add(rightShoulder);

    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.36, 16), suitMat);
    rightUpperArm.position.y = -0.18;
    rightShoulder.add(rightUpperArm);

    const rightElbow = new THREE.Group();
    rightElbow.position.y = -0.36;
    rightShoulder.add(rightElbow);

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.32, 16), skinMat);
    rightForearm.position.y = -0.16;
    rightElbow.add(rightForearm);

    const rightWrist = new THREE.Group();
    rightWrist.position.y = -0.32;
    rightElbow.add(rightWrist);
    const rightHandRig = createArticulatedHand(false);
    rightWrist.add(rightHandRig.handGroup);

    // Futuristic Base Halo / Floor Aura
    const auraGeo = new THREE.RingGeometry(0.65, 0.82, 36);
    auraGeo.rotateX(-Math.PI / 2);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.position.y = 0.02;
    character.add(aura);

    characterRef.current = {
      character,
      headGroup,
      torsoGroup,
      leftEye: leftEyeComponents,
      rightEye: rightEyeComponents,
      mouthGroup,
      upperLip,
      lowerLip,
      leftBrow,
      rightBrow,
      badge,
      aura,
      leftArm: { shoulder: leftShoulder, elbow: leftElbow, wrist: leftWrist, hand: leftHandRig },
      rightArm: { shoulder: rightShoulder, elbow: rightElbow, wrist: rightWrist, hand: rightHandRig }
    };

    // ── 7. Hybrid GLTF Model Loader (Ready Player Me / Custom .glb) ──
    let gltfMixer = null;
    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          character.visible = false; // Hide procedural model when custom GLB loads successfully
          const model = gltf.scene;
          model.position.set(0, 0, 0);
          model.scale.set(1, 1, 1);
          scene.add(model);

          if (gltf.animations && gltf.animations.length > 0) {
            gltfMixer = new THREE.AnimationMixer(model);
            const clip = gltf.animations[0];
            const action = gltfMixer.clipAction(clip);
            action.play();
          }
        },
        undefined,
        (err) => {
          console.warn("[Avatar3DCanvas] Custom GLB load failed, falling back to realistic procedural Nova:", err);
          character.visible = true;
        }
      );
    }

    // ── 8. Master Animation Loop (Micro-motions, Visemes, Sign Poses) ──
    let animationFrameId;
    const clock = new THREE.Clock();

    // Helper to curl/uncurl a finger
    const setFingerCurl = (finger, curlAmount) => {
      finger.fingerRoot.rotation.x = curlAmount;
      finger.distalGroup.rotation.x = curlAmount * 0.8;
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      animStateRef.current.time = elapsed;

      if (gltfMixer) {
        gltfMixer.update(delta);
      }

      const state = animStateRef.current;
      const action = state.action;

      // 1. Holographic Floating Dust
      particles.rotation.y = elapsed * 0.04;
      aura.rotation.z = elapsed * 0.4;

      // 2. Organic Breathing Cycle (Rhythmic chest & shoulder expansion)
      const breath = Math.sin(elapsed * 2.2);
      torsoGroup.scale.set(1 + breath * 0.012, 1 + breath * 0.008, 1 + breath * 0.016);
      character.position.y = breath * 0.015;

      // 3. Realistic Eye Micro-Saccades (Human attention focus shifts)
      if (elapsed > state.nextGazeTime) {
        state.gazeX = (Math.random() - 0.5) * 0.25;
        state.gazeY = (Math.random() - 0.5) * 0.15;
        state.nextGazeTime = elapsed + 1.8 + Math.random() * 2.5;
      }
      leftEyeComponents.gazeGroup.rotation.y = THREE.MathUtils.lerp(leftEyeComponents.gazeGroup.rotation.y, state.gazeX, 0.15);
      leftEyeComponents.gazeGroup.rotation.x = THREE.MathUtils.lerp(leftEyeComponents.gazeGroup.rotation.x, state.gazeY, 0.15);
      rightEyeComponents.gazeGroup.rotation.y = leftEyeComponents.gazeGroup.rotation.y;
      rightEyeComponents.gazeGroup.rotation.x = leftEyeComponents.gazeGroup.rotation.x;

      // 4. Smooth Eyelid Blink Mechanics
      if (elapsed > state.nextBlinkTime) {
        state.isBlinking = true;
        state.blinkProgress = 0;
        state.nextBlinkTime = elapsed + 3.0 + Math.random() * 2.5;
      }
      if (state.isBlinking) {
        state.blinkProgress += delta * 7.5;
        let eyelidCurve = 0;
        if (state.blinkProgress < 0.5) {
          eyelidCurve = state.blinkProgress * 2; // Rapid snap shut
        } else if (state.blinkProgress < 1.0) {
          eyelidCurve = (1.0 - state.blinkProgress) * 2; // Smooth open
        } else {
          state.isBlinking = false;
          eyelidCurve = 0;
        }
        leftEyeComponents.eyelid.scale.y = eyelidCurve;
        rightEyeComponents.eyelid.scale.y = eyelidCurve;
      }

      // 5. Realistic Phoneme Visemes (Mouth movements during speech)
      if (state.isSpeaking || action === "speaking") {
        const mouthOpen = Math.abs(Math.sin(elapsed * 13)) * 0.7 + 0.15;
        const mouthWidth = 1.0 + Math.cos(elapsed * 9) * 0.2;
        mouthGroup.scale.set(mouthWidth, mouthOpen + 0.2, 1);
        lowerLip.position.y = -0.018 - mouthOpen * 0.025;
        upperLip.position.y = 0.012 + mouthOpen * 0.01;
        badge.material.emissiveIntensity = 0.8 + Math.sin(elapsed * 12) * 0.35;
      } else {
        mouthGroup.scale.lerp(new THREE.Vector3(1, 0.25, 1), 0.2);
        lowerLip.position.y = -0.018;
        upperLip.position.y = 0.012;
        badge.material.emissiveIntensity = 0.5;
      }

      // 6. Skeletal Pose State Machine (ASL & Navigation Gestures)
      const rShoulder = rightShoulder.rotation;
      const rElbow = rightElbow.rotation;
      const rWrist = rightWrist.rotation;
      const rHand = rightHandRig;

      const lShoulder = leftShoulder.rotation;
      const lElbow = leftElbow.rotation;
      const lWrist = leftWrist.rotation;
      const lHand = leftHandRig;

      if (action === "wave") {
        // Friendly Human Wave
        headGroup.rotation.z = Math.sin(elapsed * 3.5) * 0.06;
        headGroup.rotation.x = -0.04;

        rShoulder.set(0.2, 0, -1.35);
        rElbow.set(0, 0, -1.1 + Math.sin(elapsed * 8) * 0.35);
        rWrist.set(0, 0, Math.sin(elapsed * 8) * 0.25);

        // Relaxed open hand with natural finger curvature
        setFingerCurl(rHand.index, 0.25);
        setFingerCurl(rHand.middle, 0.35);
        setFingerCurl(rHand.ring, 0.45);
        setFingerCurl(rHand.pinky, 0.55);

        // Left arm resting naturally
        lShoulder.set(0.12, 0, 0.18);
        lElbow.set(0, 0, 0.3);
      } else if (action === "point_courses" || action === "courses") {
        // Pointing Gesture ☝️: Index finger straight, others curled
        headGroup.rotation.y = 0.12;
        headGroup.rotation.x = -0.08;

        rShoulder.set(-1.3, 0.15, -0.32);
        rElbow.set(-0.15, 0, -0.2);
        rWrist.set(0.1, 0.2, 0);

        // Articulated Index Point Pose
        rHand.thumb.root.rotation.x = 0.6;
        setFingerCurl(rHand.index, -0.05); // Fully extended index pointing forward
        setFingerCurl(rHand.middle, 1.4); // Curled
        setFingerCurl(rHand.ring, 1.45);  // Curled
        setFingerCurl(rHand.pinky, 1.5);  // Curled

        lShoulder.set(-0.4, 0, 0.4);
        lElbow.set(0, 0, 0.7);
        setFingerCurl(lHand.index, 0.5);
      } else if (action === "thumbs_up" || action === "nod") {
        // Thumbs Up 👍: Fist curled, thumb extended vertically + head nod
        headGroup.rotation.x = Math.sin(elapsed * 6) * 0.14;
        headGroup.rotation.y = 0;

        rShoulder.set(-0.75, 0, -0.45);
        rElbow.set(0, 0, -1.1);
        rWrist.set(0, 0.4, 0);

        // Thumbs Up Finger Configuration
        rHand.thumb.root.rotation.set(-0.7, 0, 0); // Thumb pointing straight UP
        rHand.thumb.distal.rotation.x = 0;
        setFingerCurl(rHand.index, 1.5); // Curled fist
        setFingerCurl(rHand.middle, 1.55);
        setFingerCurl(rHand.ring, 1.6);
        setFingerCurl(rHand.pinky, 1.65);

        lShoulder.set(-0.3, 0, 0.25);
        lElbow.set(0, 0, 0.5);
      } else if (action === "peace") {
        // Victory / Peace Sign ✌️
        rShoulder.set(-0.85, 0, -0.5);
        rElbow.set(0, 0, -1.15);
        rWrist.set(0, 0.2, 0);

        setFingerCurl(rHand.index, -0.05);  // Extended
        setFingerCurl(rHand.middle, -0.05); // Extended
        setFingerCurl(rHand.ring, 1.5);     // Curled
        setFingerCurl(rHand.pinky, 1.5);    // Curled
        rHand.thumb.root.rotation.x = 0.9;
      } else if (action === "sign_asl" || action === "detecting") {
        // Active ASL Signing Space (Both hands articulating rhythmically)
        headGroup.rotation.y = Math.sin(elapsed * 2) * 0.08;
        headGroup.rotation.x = -0.05;

        const aslCycle = Math.sin(elapsed * 4);
        const aslCycle2 = Math.cos(elapsed * 4);

        lShoulder.set(-0.75 + aslCycle * 0.12, 0.1, 0.52);
        lElbow.set(0, 0, 1.05 + aslCycle * 0.18);
        setFingerCurl(lHand.index, 0.4 + aslCycle * 0.4);
        setFingerCurl(lHand.middle, 0.6 + aslCycle * 0.3);

        rShoulder.set(-0.75 + aslCycle2 * 0.12, -0.1, -0.52);
        rElbow.set(0, 0, -1.05 - aslCycle2 * 0.18);
        setFingerCurl(rHand.index, 0.4 + aslCycle2 * 0.4);
        setFingerCurl(rHand.middle, 0.6 + aslCycle2 * 0.3);
      } else {
        // Default Lifelike Idle (Gentle human swaying & breathing)
        headGroup.rotation.x = Math.sin(elapsed * 1.4) * 0.035;
        headGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.055;
        headGroup.rotation.z = Math.sin(elapsed * 0.6) * 0.02;

        lShoulder.set(0.12, 0, 0.18);
        lElbow.set(0, 0, 0.35 + Math.sin(elapsed * 2.2) * 0.025);
        rShoulder.set(0.12, 0, -0.18);
        rElbow.set(0, 0, -0.35 - Math.sin(elapsed * 2.2) * 0.025);

        // Relaxed natural finger curve
        setFingerCurl(rHand.index, 0.3);
        setFingerCurl(rHand.middle, 0.38);
        setFingerCurl(rHand.ring, 0.45);
        setFingerCurl(rHand.pinky, 0.52);

        setFingerCurl(lHand.index, 0.3);
        setFingerCurl(lHand.middle, 0.38);
        setFingerCurl(lHand.ring, 0.45);
        setFingerCurl(lHand.pinky, 0.52);
      }

      renderer.render(scene, camera);
    };

    animate();

    // ── 9. Resize Handling ─────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelUrl]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
