/** Per-frame values shared between the camera rig, the drone and the HUD, kept out of React state. */
export const rig = {
  /** Current (smoothed) floor coordinate the camera is looking at. */
  focus: 0,
  /** 0..1 while the drone dives into a window. */
  dive: 0,
  droneVisible: true,
  yawSpeed: 0,
  lastInput: 0,
  /** Photo mode for share images: the scene without the drone. */
  hideDrone: false,
}
