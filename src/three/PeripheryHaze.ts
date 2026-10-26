import { BlendFunction, Effect, KawaseBlurPass, KernelSize } from 'postprocessing'
import * as THREE from 'three'

const fragmentShader = /* glsl */ `
  uniform sampler2D blurMap;
  uniform float strength;
  uniform vec3 hazeColor;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 p = (uv - 0.5) * 2.0;
    float r = length(p * vec2(1.0, 0.82));
    float m = clamp(smoothstep(0.32, 1.12, r) * strength, 0.0, 1.0);
    vec3 soft = texture2D(blurMap, uv).rgb;
    vec3 col = mix(inputColor.rgb, soft, clamp(m * 1.9, 0.0, 1.0));
    col = mix(col, hazeColor + soft * 0.4, m * 0.62);
    outputColor = vec4(col, inputColor.a);
  }
`

/**
 * Pulls the screen edges out of focus and into a violet haze. Driven by camera distance, so a
 * zoomed-out view softens into cloud instead of showing where the set ends.
 */
export class PeripheryHazeEffect extends Effect {
  readonly blurPass: KawaseBlurPass
  readonly renderTarget: THREE.WebGLRenderTarget

  constructor({ kernelSize = KernelSize.LARGE, resolutionScale = 0.5, color = '#2a1446' } = {}) {
    super('PeripheryHazeEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['blurMap', new THREE.Uniform(null)],
        ['strength', new THREE.Uniform(0)],
        ['hazeColor', new THREE.Uniform(new THREE.Color(color))],
      ]),
    })
    this.renderTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false })
    this.renderTarget.texture.name = 'PeripheryHaze.Blur'
    this.uniforms.get('blurMap')!.value = this.renderTarget.texture
    this.blurPass = new KawaseBlurPass({ kernelSize, resolutionScale })
  }

  get strength(): number {
    return this.uniforms.get('strength')!.value
  }

  set strength(value: number) {
    this.uniforms.get('strength')!.value = value
  }

  override update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget) {
    if (this.strength > 0.002) this.blurPass.render(renderer, inputBuffer, this.renderTarget)
  }

  override setSize(width: number, height: number) {
    this.blurPass.setSize(width, height)
    const r = this.blurPass.resolution
    this.renderTarget.setSize(r.width, r.height)
  }

  override initialize(renderer: THREE.WebGLRenderer, alpha: boolean, frameBufferType: number) {
    this.blurPass.initialize(renderer, alpha, frameBufferType)
    if (frameBufferType !== undefined) {
      this.renderTarget.texture.type = frameBufferType as THREE.TextureDataType
      if (frameBufferType === THREE.UnsignedByteType && renderer?.outputColorSpace === THREE.SRGBColorSpace) {
        this.renderTarget.texture.colorSpace = THREE.SRGBColorSpace
      }
    }
  }

  override dispose() {
    super.dispose()
    this.blurPass.dispose()
    this.renderTarget.dispose()
  }
}
