import { useRef, useCallback, useEffect } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { detectGesture } from '../gestureUtils.js';

export function useVision(onFrame) {
  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const tPrevRef = useRef(-1);
  const prevLmRef = useRef(null);

  const initVision = useCallback(async () => {
    const fs = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    landmarkerRef.current = await HandLandmarker.createFromOptions(fs, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        aspectRatio: { ideal: 1 },
      },
      audio: false,
    });
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    await video.play();

    const loop = () => {
      const v = videoRef.current;
      if (!v || v.ended || v.paused) { rafRef.current = requestAnimationFrame(loop); return; }
      if (v.currentTime !== tPrevRef.current) {
        tPrevRef.current = v.currentTime;
        const res = landmarkerRef.current?.detectForVideo(v, performance.now());
        let raw = null;
        let px = 0.5, py = 0.5;
        let gesture = null;
        let fingers = null;
        if (res?.landmarks?.length) {
          const lm = res.landmarks[0];
          const dPI = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
          const dRef = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);
          if (dRef > 1e-6) raw = dPI / dRef;
          px = (lm[4].x + lm[8].x) / 2;
          py = (lm[4].y + lm[8].y) / 2;
          gesture = detectGesture(lm, prevLmRef.current);
          fingers = gesture.fingers;
          prevLmRef.current = lm;
        }
        onFrame({ raw, px, py, landmarks: res?.landmarks?.[0] || null, videoWidth: v.videoWidth, videoHeight: v.videoHeight, gesture, fingers });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [onFrame]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return { videoRef, initVision };
}
