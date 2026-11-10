"use client";
import { useState, useEffect, type FC } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
// @ts-expect-error no types available for GLTFLoader
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Vector3 } from "three";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { CRT_FPS } from "../crt";

export const VRMModel: FC<{
  vrm: import("@pixiv/three-vrm").VRM | null;
  mousePosition: { x: number; y: number };
}> = ({ vrm, mousePosition }) => {
  useFrame((_state, frameDelta) => {
    // After a pause the gap since the last frame is long; don't spin or swing the model through it.
    const delta = Math.min(frameDelta, 1 / CRT_FPS);
    if (vrm) {
      vrm.scene.position.set(0, -4, 0);
      vrm.scene.scale.set(8, 7, 7);
      vrm.scene.rotateY(delta * 1.5);
      vrm.expressionManager?.setValue("neutral", 1);
      vrm.expressionManager?.setValue("aa", 1.5);

      if (vrm.lookAt) {
        const lookAtTarget = new Vector3(mousePosition.x * 3, mousePosition.y * 3, 5);
        vrm.lookAt.lookAt(lookAtTarget);
      }

      const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
      const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
      const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode("leftLowerArm");
      const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode("rightLowerArm");

      if (leftUpperArm) leftUpperArm.rotation.z = -Math.PI * 1.65;
      if (rightUpperArm) rightUpperArm.rotation.z = Math.PI * 1.65;
      if (leftLowerArm) leftLowerArm.rotation.z = -Math.PI * -2;
      if (rightLowerArm) rightLowerArm.rotation.z = Math.PI * -2;

      vrm.update(delta);
    }
  });

  return vrm ? <primitive object={vrm.scene} dispose={null} /> : null;
};

type VRM = import("@pixiv/three-vrm").VRM;

// Loaded once and kept, so showing the model again doesn't reload it.
let loadedVrm: VRM | null = null;
let vrmLoad: Promise<VRM> | undefined;

function loadVrm() {
  vrmLoad ??= new Promise<VRM>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.register((parser: any) => new VRMLoaderPlugin(parser));
    loader.load(
      "https://cdn.mikn.dev/vroid/みかん(Web).vrm",
      (gltf: GLTF) => resolve((loadedVrm = gltf.userData.vrm)),
      undefined,
      reject,
    );
  }).catch((error: unknown) => {
    vrmLoad = undefined;
    throw error;
  });
  return vrmLoad;
}

/** Renders a frame CRT_FPS times a second while `active`, and none otherwise. */
function LowFramerate({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => invalidate(), 1000 / CRT_FPS);
    return () => clearInterval(timer);
  }, [active, invalidate]);
  return null;
}

/** The spinning model. While not `active` it stays loaded but stops rendering. */
export function TPoseRotate({ active = true }: { active?: boolean }) {
  const [vrm, setVrm] = useState<VRM | null>(loadedVrm);
  const [isLoaded, setIsLoaded] = useState(loadedVrm !== null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (loadedVrm) return;
    let active = true;
    loadVrm().then(
      (loaded) => {
        if (!active) return;
        setVrm(loaded);
        setIsLoaded(true);
      },
      (error: unknown) => console.error("An error occurred while loading the model:", error),
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;
      setMousePosition({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="overflow-hidden size-full relative">
      <div className="flex flex-col justify-center items-center w-full h-full">
        {!isLoaded ? (
          <div className="flex items-center justify-center">
            <span className="loading loading-spinner loading-xl text-primary" />
          </div>
        ) : (
          <Canvas frameloop="demand" camera={{ position: [0, 0, 6.5] }}>
            <LowFramerate active={active} />
            <ambientLight intensity={1.8} />
            <VRMModel vrm={vrm} mousePosition={mousePosition} />
          </Canvas>
        )}
      </div>
    </div>
  );
}
