import React, { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * 3D WebGL Avatar Canvas using Three.js
 * Renders a stylized, expressive 3D Assistant ("Nova" / "Echo")
 * with animated head, eyes, mouth visemes, and articulated signing hands.
 */
export default function Avatar3DCanvas({
  avatarAction = "idle", // 'idle' | 'wave' | 'point_courses' | 'nod' | 'thumbs_up' | 'sign_asl' | 'speaking'
  isSpeaking = false,
  status = "ready", // 'ready' | 'detecting' | 'executed'
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
    actionStartTime: 0
  });

  // Keep animState updated without recreating Three.js scene
  useEffect(() => {
    animStateRef.current.action = avatarAction;
    animStateRef.current.isSpeaking = isSpeaking;
    animStateRef.current.actionStartTime = animStateRef.current.time;
  }, [avatarAction, isSpeaking]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.25, 3.4);
    camera.lookAt(0, 1.1, 0);

    // 2. WebGL Renderer with transparency & antialiasing
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 3. Lighting Setup (Soft Studio + Futuristic Rim Light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.0); // Cyan glow
    mainLight.position.set(2, 4, 3);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xa855f7, 1.5); // Purple accent
    fillLight.position.set(-2, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x06b6d4, 3.0, 10);
    rimLight.position.set(0, 3, -2);
    scene.add(rimLight);

    // 4. Background Holographic Floating Particles
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 45;
    const posArray = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 4;
      posArray[i + 1] = Math.random() * 3;
      posArray[i + 2] = (Math.random() - 0.5) * 3;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.04,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 5. Stylized 3D Character Rigging
    const character = new THREE.Group();
    scene.add(character);

    // Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfbd0b0,
      roughness: 0.5,
      metalness: 0.05
    });

    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.6
    });

    const cyanNeonMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00d2b4,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });

    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4
    });

    // Torso / Shoulders
    const torsoGeo = new THREE.CylinderGeometry(0.38, 0.45, 0.9, 16);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 0.45;
    character.add(torso);

    // Cyber chest badge
    const badgeGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16);
    badgeGeo.rotateX(Math.PI / 2);
    const badge = new THREE.Mesh(badgeGeo, cyanNeonMat);
    badge.position.set(0, 0.65, 0.4);
    character.add(badge);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.2, 16);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = 0.95;
    character.add(neck);

    // Head Group (for rotation/nodding)
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.25;
    character.add(headGroup);

    // Head base mesh
    const headGeo = new THREE.SphereGeometry(0.35, 32, 32);
    headGeo.scale(1, 1.15, 1);
    const head = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(head);

    // Stylized Hair
    const hairGeo = new THREE.SphereGeometry(0.38, 24, 24);
    hairGeo.scale(1.02, 0.8, 1.1);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.18, -0.05);
    headGroup.add(hair);

    // Glasses / Cyber Visor
    const visorGeo = new THREE.TorusGeometry(0.28, 0.035, 8, 24, Math.PI);
    visorGeo.rotateX(Math.PI / 2);
    visorGeo.rotateZ(Math.PI);
    const visor = new THREE.Mesh(visorGeo, cyanNeonMat);
    visor.position.set(0, 0.06, 0.28);
    headGroup.add(visor);

    // Eyes (Left & Right)
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), eyeWhiteMat);
    leftEye.position.set(-0.13, 0.05, 0.3);
    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), pupilMat);
    leftPupil.position.set(-0.13, 0.05, 0.35);
    headGroup.add(leftEye, leftPupil);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), eyeWhiteMat);
    rightEye.position.set(0.13, 0.05, 0.3);
    const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), pupilMat);
    rightPupil.position.set(0.13, 0.05, 0.35);
    headGroup.add(rightEye, rightPupil);

    // Eyelids (for blinking)
    const eyelidMat = skinMat;
    const leftEyelid = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), eyelidMat);
    leftEyelid.position.set(-0.13, 0.05, 0.3);
    leftEyelid.rotation.x = Math.PI;
    leftEyelid.visible = false;
    headGroup.add(leftEyelid);

    const rightEyelid = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), eyelidMat);
    rightEyelid.position.set(0.13, 0.05, 0.3);
    rightEyelid.rotation.x = Math.PI;
    rightEyelid.visible = false;
    headGroup.add(rightEyelid);

    // Mouth / Viseme mesh
    const mouthGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
    mouthGeo.rotateX(Math.PI / 2);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x991b1b });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, -0.16, 0.32);
    mouth.scale.set(1, 0.25, 1);
    headGroup.add(mouth);

    // Left Arm Hierarchy
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(-0.48, 0.78, 0);
    character.add(leftShoulder);

    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.35, 12), suitMat);
    leftUpperArm.position.y = -0.17;
    leftShoulder.add(leftUpperArm);

    const leftElbow = new THREE.Group();
    leftElbow.position.y = -0.35;
    leftShoulder.add(leftElbow);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 12), skinMat);
    leftForearm.position.y = -0.16;
    leftElbow.add(leftForearm);

    const leftHand = new THREE.Group();
    leftHand.position.y = -0.32;
    const leftPalm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), skinMat);
    leftHand.add(leftPalm);
    leftElbow.add(leftHand);

    // Right Arm Hierarchy
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(0.48, 0.78, 0);
    character.add(rightShoulder);

    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.35, 12), suitMat);
    rightUpperArm.position.y = -0.17;
    rightShoulder.add(rightUpperArm);

    const rightElbow = new THREE.Group();
    rightElbow.position.y = -0.35;
    rightShoulder.add(rightElbow);

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 12), skinMat);
    rightForearm.position.y = -0.16;
    rightElbow.add(rightForearm);

    const rightHand = new THREE.Group();
    rightHand.position.y = -0.32;
    const rightPalm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), skinMat);
    rightHand.add(rightPalm);
    rightElbow.add(rightHand);

    // Halo Aura Ring at base
    const auraGeo = new THREE.RingGeometry(0.7, 0.85, 32);
    auraGeo.rotateX(-Math.PI / 2);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.position.y = 0.02;
    character.add(aura);

    characterRef.current = {
      character,
      headGroup,
      leftEyelid,
      rightEyelid,
      mouth,
      leftShoulder,
      leftElbow,
      leftHand,
      rightShoulder,
      rightElbow,
      rightHand,
      aura,
      badge
    };

    // 6. Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      animStateRef.current.time = elapsed;

      const state = animStateRef.current;
      const action = state.action;
      const actionDuration = elapsed - state.actionStartTime;

      // Particle floating
      particles.rotation.y = elapsed * 0.05;

      // Subtle base breathing & float
      character.position.y = Math.sin(elapsed * 2) * 0.03;
      aura.rotation.z = elapsed * 0.5;

      // Blinking behavior
      const blinkCycle = elapsed % 4.0;
      const isBlinking = blinkCycle > 3.85 && blinkCycle < 3.98;
      leftEyelid.visible = isBlinking;
      rightEyelid.visible = isBlinking;

      // Mouth viseme speaking motion
      if (state.isSpeaking || action === "speaking") {
        const mouthOpen = Math.abs(Math.sin(elapsed * 12)) * 0.8 + 0.2;
        mouth.scale.set(1.2, mouthOpen, 1);
        badge.material.emissiveIntensity = 0.8 + Math.sin(elapsed * 10) * 0.4;
      } else {
        mouth.scale.set(1, 0.2, 1);
        badge.material.emissiveIntensity = 0.5;
      }

      // Action Pose Machine (Interpolated Skeletal Gestures)
      if (action === "wave") {
        // Friendly Wave
        headGroup.rotation.z = Math.sin(elapsed * 4) * 0.08;
        headGroup.rotation.x = 0;
        
        // Right Arm Waves
        rightShoulder.rotation.z = -1.2;
        rightShoulder.rotation.x = 0.2;
        rightElbow.rotation.z = -1.1 + Math.sin(elapsed * 8) * 0.4;
        rightHand.rotation.z = Math.sin(elapsed * 8) * 0.3;

        // Left Arm Idle
        leftShoulder.rotation.z = 0.2;
        leftShoulder.rotation.x = 0.1;
        leftElbow.rotation.z = 0.4;
      } else if (action === "point_courses" || action === "courses") {
        // Pointing forward enthusiastically towards Courses
        headGroup.rotation.y = 0.15;
        headGroup.rotation.x = -0.1;

        // Right Arm points forward & up
        rightShoulder.rotation.x = -1.4;
        rightShoulder.rotation.z = -0.3;
        rightElbow.rotation.x = -0.2;
        rightElbow.rotation.z = -0.2;
        rightHand.rotation.y = Math.sin(elapsed * 6) * 0.1;

        // Left Arm sign support
        leftShoulder.rotation.x = -0.6;
        leftShoulder.rotation.z = 0.6;
        leftElbow.rotation.z = 0.8;
      } else if (action === "nod" || action === "thumbs_up") {
        // Nodding affirmatively + Thumbs up pose
        headGroup.rotation.x = Math.sin(elapsed * 6) * 0.15;
        headGroup.rotation.y = 0;

        // Right Hand Thumbs up
        rightShoulder.rotation.x = -0.8;
        rightShoulder.rotation.z = -0.4;
        rightElbow.rotation.z = -0.9;
        rightHand.rotation.y = 0.3;

        // Left Hand ready
        leftShoulder.rotation.x = -0.4;
        leftShoulder.rotation.z = 0.3;
      } else if (action === "sign_asl" || action === "detecting") {
        // Signing posture: both hands active in signing space in front of chest
        headGroup.rotation.y = Math.sin(elapsed * 2) * 0.08;
        
        leftShoulder.rotation.x = -0.8 + Math.sin(elapsed * 4) * 0.15;
        leftShoulder.rotation.z = 0.5;
        leftElbow.rotation.z = 1.0 + Math.cos(elapsed * 4) * 0.2;

        rightShoulder.rotation.x = -0.8 + Math.cos(elapsed * 4) * 0.15;
        rightShoulder.rotation.z = -0.5;
        rightElbow.rotation.z = -1.0 - Math.sin(elapsed * 4) * 0.2;
      } else {
        // Default Idle / Listening posture
        headGroup.rotation.x = Math.sin(elapsed * 1.5) * 0.04;
        headGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.06;
        headGroup.rotation.z = 0;

        // Resting arms
        leftShoulder.rotation.set(0.1, 0, 0.15);
        leftElbow.rotation.set(0, 0, 0.3 + Math.sin(elapsed * 2) * 0.03);

        rightShoulder.rotation.set(0.1, 0, -0.15);
        rightElbow.rotation.set(0, 0, -0.3 - Math.sin(elapsed * 2) * 0.03);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 7. Resize Observer
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
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
