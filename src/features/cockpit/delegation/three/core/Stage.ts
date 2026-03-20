import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENE_BACKGROUND_COLOR } from '../constants';

export class Stage {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;

  private followTarget: THREE.Vector3 | null = null;
  private readonly defaultTarget = new THREE.Vector3(0, 0.8, 0);
  private readonly defaultCameraPosition = new THREE.Vector3(9.5, 7.4, 12.2);

  constructor(rendererElement: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.copy(this.defaultCameraPosition);

    this.controls = new OrbitControls(this.camera, rendererElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.8;
    this.controls.enableRotate = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.minPolarAngle = Math.PI / 4.5;
    this.controls.maxPolarAngle = Math.PI / 2.4;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 12;
    this.controls.target.copy(this.defaultTarget);

    this.controls.addEventListener('start', () => {
      rendererElement.style.cursor = 'grabbing';
    });
    this.controls.addEventListener('end', () => {
      rendererElement.style.cursor = 'auto';
    });

    this.setupLights();
    // Environment is initialized with a default, but updated via updateDimensions immediately in SceneManager
  }

  private setupLights() {
    const hemisphereLight = new THREE.HemisphereLight(0xe5eefc, 0x05070c, 0.95 * Math.PI);
    this.scene.add(hemisphereLight);

    const ambientLight = new THREE.AmbientLight(0xc7d7ff, 0.45 * Math.PI);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2 * Math.PI);
    keyLight.position.set(12, 18, 10);
    keyLight.castShadow = true;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 100;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.radius = 2;
    keyLight.shadow.autoUpdate = true;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.28 * Math.PI);
    fillLight.position.set(-10, 9, -6);
    this.scene.add(fillLight);
  }

  public onResize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Call every frame with the character's world position to follow, or null to return to origin. */
  public setFollowTarget(pos: THREE.Vector3 | null) {
    this.followTarget = pos ? pos.clone() : null;
  }

  public resetView() {
    this.followTarget = null;
    this.camera.position.copy(this.defaultCameraPosition);
    this.controls.target.copy(this.defaultTarget);
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 12;
    this.controls.update();
  }

  public update() {
    const lerpTarget = this.followTarget
      ? new THREE.Vector3(this.followTarget.x, 0.8, this.followTarget.z)
      : this.defaultTarget;
    this.controls.target.lerp(lerpTarget, 0.06);
    this.controls.update();
  }

  /**
   * Drive camera behavior based on chat state.
   * Call every frame from the animation loop.
   *
   * @param isChatting  True while a conversation is active.
   * @param playerMoving True while player is walking toward the NPC (GOTO state).
   */
  public setChatMode(isChatting: boolean, playerMoving: boolean): void {
    if (!this.controls) return;

    if (isChatting) {
      if (playerMoving) {
        // Lock controls and zoom in while walking
        this.controls.enabled = false;
        this.controls.minDistance = THREE.MathUtils.lerp(this.controls.minDistance, 4, 0.05);
        this.controls.maxDistance = THREE.MathUtils.lerp(this.controls.maxDistance, 6, 0.05);
      } else {
        // Arrived — re-enable controls, stay slightly zoomed
        this.controls.enabled = true;
        this.controls.minDistance = THREE.MathUtils.lerp(this.controls.minDistance, 3, 0.05);
        this.controls.maxDistance = THREE.MathUtils.lerp(this.controls.maxDistance, 10, 0.05);
      }
    } else {
      // Free roam
      this.controls.enabled = true;
      this.controls.minDistance = THREE.MathUtils.lerp(this.controls.minDistance, 3.2, 0.05);
      this.controls.maxDistance = THREE.MathUtils.lerp(this.controls.maxDistance, 12, 0.05);
    }
  }
}
