import * as THREE from 'three'
import { SANITIZE } from '@/three/toon'

/**
 * The picture tube. The montage canvas is graded here (black-and-white film, warm CRT, clean LCD)
 * so the 2D drawing code stays era-agnostic and Safari, which lacks canvas filters, looks the same.
 */
export function createScreenMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uCurve: { value: 1 },
      uScan: { value: 1 },
      uMono: { value: 1 },
      uSepia: { value: 0.35 },
      uPower: { value: 0 },
      uBright: { value: 1.1 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
      uLines: { value: 480 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uCurve, uScan, uMono, uSepia, uPower, uBright, uFlash, uTime, uLines;
      varying vec2 vUv;
      void main() {
        vec2 c = vUv * 2.0 - 1.0;
        c *= 1.0 + uCurve * dot(c, c) * 0.09;
        vec2 uv = c * 0.5 + 0.5;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);

        float squash = max(uPower, 0.002);
        float v = (uv.y - 0.5) / squash + 0.5;
        float onPicture = step(0.0, v) * step(v, 1.0);
        vec3 col = texture2D(map, vec2(uv.x, clamp(v, 0.0, 1.0))).rgb * onPicture;

        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(l), uMono);
        col = mix(col, vec3(l) * vec3(1.08, 0.98, 0.82), uSepia);

        float scan = 0.5 + 0.5 * sin(uv.y * uLines * 3.14159);
        float resolvable = clamp(1.6 - fwidth(uv.y * uLines) * 2.0, 0.0, 1.0);
        col *= 1.0 - uScan * 0.28 * scan * resolvable;
        col *= 1.0 - uCurve * 0.42 * dot(c, c);
        col *= 1.0 + uScan * 0.04 * sin(uTime * 60.0);

        float line = (1.0 - uPower) * exp(-abs(uv.y - 0.5) * 140.0) * step(0.001, uPower + 0.02);
        col += vec3(line * 2.2);
        col = mix(col, vec3(1.25), uFlash);
        col *= uBright * inside;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        ${SANITIZE}
      }`,
    toneMapped: false,
  })
}

export const ERA_LOOK = {
  film: { uCurve: 1, uScan: 1, uMono: 1, uSepia: 0.35, uLines: 420 },
  crt: { uCurve: 0.75, uScan: 0.75, uMono: 0, uSepia: 0.12, uLines: 520 },
  hd: { uCurve: 0, uScan: 0, uMono: 0, uSepia: 0, uLines: 720 },
} as const
