
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { DRACO_LIB_PATH } from '../constants';
import { NavMeshManager } from '../pathfinding/NavMeshManager';
import { PoiManager } from './PoiManager';
import { getAgentSet } from '../../data/agents';
import { useAgencyStore } from '../../store/agencyStore';
import { SceneBootError } from '../core/SceneBootError';

export class WorldManager {
  private office: THREE.Group | null = null;

  constructor(
    private scene: THREE.Scene,
    private navMesh: NavMeshManager,
    private poiManager: PoiManager
  ) {}

  public async load(): Promise<void> {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_LIB_PATH);
    loader.setDRACOLoader(dracoLoader);
    let officeGltf: Awaited<ReturnType<typeof loader.loadAsync>>;

    try {
      officeGltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/office.glb`);
    } catch (error) {
      throw new SceneBootError(
        'asset_load_failed',
        'Unable to load the Delegation office model.',
        { cause: error },
      );
    }

    this.office = officeGltf.scene;
    this.scene.add(this.office);

    // Get current AgentSet color
    const selectedAgentSetId = useAgencyStore.getState().selectedAgentSetId;
    const activeSet = getAgentSet(selectedAgentSetId);
    const themeColor = new THREE.Color(activeSet.color);

    // Extract NavMesh and setup
    this.office.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();

        if (name.includes('navmesh')) {
          this.navMesh.loadFromGeometry(mesh.geometry);
          mesh.visible = false;
        } else {
          mesh.receiveShadow = true;
          mesh.castShadow = true;

          // Apply specific material for WebGPU shadow compatibility as requested
          if (mesh.material) {
            const oldMat = mesh.material as THREE.MeshStandardMaterial;

            // Check if mesh name starts with "colored" to apply thematic color
            const isColoredMesh = name.startsWith('colored');
            const isFloorLike =
              name.includes('floor')
              || name.includes('ground')
              || name.includes('base')
              || name.includes('platform');
            const baseColor = oldMat.color?.clone() ?? new THREE.Color(0xd4d9e3);
            const shadedColor = isColoredMesh
              ? themeColor.clone()
              : isFloorLike
                ? baseColor.lerp(new THREE.Color(0x1b2532), 0.65)
                : baseColor.lerp(new THREE.Color(0xdbe4ef), 0.28);

            mesh.material = new THREE.MeshStandardNodeMaterial({
              color: shadedColor,
              map: oldMat.map,
              roughness: isColoredMesh ? 0.7 : 0.92,
              metalness: isColoredMesh ? 0.12 : 0.08,
            });
          }
        }
      }
    });

    // Extract Points of Interest
    this.poiManager.loadFromGlb(this.office);
  }

  public updateThemeColor(color: string): void {
    if (!this.office) return;

    const themeColor = new THREE.Color(color);

    this.office.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();

        if (name.startsWith('colored') && mesh.material) {
          // Update existing material color if it's a NodeMaterial
          // or replace it if needed. Since we already replaced them in load(),
          // we can just update the color property.
          if ((mesh.material as any).color) {
            (mesh.material as any).color.copy(themeColor);
          }
        }
      }
    });
  }

  public getOffice(): THREE.Group | null {
    return this.office;
  }
}
