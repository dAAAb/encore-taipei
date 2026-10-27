import * as THREE from 'three'
import { SANITIZE } from '@/three/toon'

/**
 * Floor-to-ceiling glass with a party behind it. The stage's share image is sampled at a high mip
 * level (cheap blur), drifts like a looping clip, and gets sweeping stage lights; on top sits a
 * frosted reflection with a travelling glint. `sharp` keeps "for lease" cards readable.
 */
export function glassMaterial(map: THREE.Texture, opts: { seed: number; aspect: number; sharp?: boolean; side?: boolean }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      time: { value: 0 },
      hover: { value: 0 },
      seed: { value: opts.seed },
      aspect: { value: opts.aspect },
      sharp: { value: opts.sharp ? 1 : 0 },
      sideFace: { value: opts.side ? 1 : 0 },
      imageAspect: { value: 1200 / 630 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * normal);
        vec3 toCam = normalize(cameraPosition - wp.xyz);
        // view direction in the panel's own frame (x across, y up, z out of the glass)
        vec3 t = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
        vView = vec3(dot(toCam, t), toCam.y, dot(toCam, n));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float time, hover, seed, aspect, sharp, sideFace, imageAspect;
      varying vec2 vUv;
      varying vec3 vView;

      float hash(float n) { return fract(sin(n) * 43758.5453); }

      void main() {
        // cover-fit the 1200x630 image onto the wide panel, then look "into" the room with a little parallax
        vec2 uv = vUv - 0.5;
        uv.y *= imageAspect / aspect;
        uv *= mix(0.82, 0.96, sharp);
        vec2 par = vView.xy / max(0.3, vView.z) * mix(0.05, 0.015, sharp);
        uv += 0.5 - par;
        uv += (1.0 - sharp) * vec2(sin(time * 0.13 + seed), cos(time * 0.11 + seed * 1.7)) * 0.025;
        uv.x += sideFace * (seed * 0.37);
        uv = clamp(uv, 0.002, 0.998);

        float blur = mix(2.6, 0.0, sharp) + sideFace * 1.5;
        vec3 room = texture2D(map, uv, blur).rgb;

        // the party: colour washes, a strobe beat and moving beams, gentler on empty storeys
        float party = 1.0 - sharp;
        float beat = pow(0.5 + 0.5 * sin(time * 4.2 + seed * 3.0), 6.0);
        float beamA = smoothstep(0.82, 1.0, 0.5 + 0.5 * sin(vUv.x * 7.0 - time * 1.3 + seed));
        float beamB = smoothstep(0.86, 1.0, 0.5 + 0.5 * sin(vUv.x * 5.0 + time * 1.7 + seed * 2.0));
        vec3 wash = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + time * 0.05 + seed));
        room *= 0.78 + 0.32 * sin(time * 1.9 + seed * 5.0) * party + 0.25 * beat * party;
        room += party * (wash * 0.10 + vec3(1.0, 0.25, 0.6) * beamA * 0.22 + vec3(0.3, 0.7, 1.0) * beamB * 0.2);
        room *= 1.0 - sideFace * 0.35;

        // glass: tinted, frosted toward the edges, sky reflection by fresnel and a slow diagonal glint
        float fres = pow(1.0 - clamp(abs(vView.z), 0.0, 1.0), 2.2);
        vec3 sky = mix(vec3(0.05, 0.06, 0.14), vec3(0.32, 0.36, 0.62), vUv.y);
        float frost = smoothstep(0.32, 0.5, abs(vUv.y - 0.5)) * 0.35;
        float g = fract((vUv.x * aspect * 0.18 + vUv.y * 0.6) - time * 0.035 + seed);
        float glint = smoothstep(0.05, 0.0, abs(g - 0.5)) * 0.35;
        vec3 col = mix(room, sky, clamp(0.12 + fres * 0.55 + frost, 0.0, 0.85)) + glint * vec3(0.8, 0.85, 1.0);

        // mullions every ~2.7 m and a transom near the top
        float bays = max(1.0, floor(aspect * 1.6));
        float mx = abs(fract(vUv.x * bays) - 0.5);
        float mull = smoothstep(0.492, 0.5, mx) + smoothstep(0.012, 0.0, abs(vUv.y - 0.86));
        col = mix(col, vec3(0.04, 0.04, 0.06), clamp(mull, 0.0, 1.0) * 0.85);

        col += hover * vec3(0.30, 0.24, 0.06) + hover * 0.25 * smoothstep(0.46, 0.5, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
        gl_FragColor = vec4(col * 1.08, 1.0);
        ${SANITIZE}
        #include <colorspace_fragment>
      }
    `,
  })
}
