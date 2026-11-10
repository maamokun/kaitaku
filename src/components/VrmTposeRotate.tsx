"use client";
import { useState, useEffect, FC } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
// @ts-expect-error no types available for GLTFLoader
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Vector3 } from "three";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { Spinner } from "@/components/ui/shadcn-io/spinner";

export const VRMModel: FC<{
  vrm: import("@pixiv/three-vrm").VRM | null;
  mousePosition: { x: number; y: number };
}> = ({ vrm, mousePosition }) => {
  useFrame((_state, delta) => {
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

  return vrm ? <primitive object={vrm.scene} /> : null;
};

export function TPoseRotate() {
  const [vrm, setVrm] = useState<import("@pixiv/three-vrm").VRM | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser: any) => new VRMLoaderPlugin(parser));

    loader.load(
      "https://cdn.mikn.dev/vroid/みかん(Web).vrm",
      (gltf: GLTF) => {
        const loadedVrm = gltf.userData.vrm;
        setVrm(loadedVrm);
        setIsLoaded(true);
      },
      undefined,
      (error: Error) => {
        console.error("An error occurred while loading the model:", error);
      },
    );
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
    <div className="overflow-hidden w-7h h-60 md:w-150 md:h-120 relative">
      <div className="flex flex-col justify-center items-center w-full h-full">
        {!isLoaded ? (
          <div className="flex items-center justify-center">
            <Spinner className={"text-primary size-12"} />
          </div>
        ) : (
          <Canvas camera={{ position: [0, 0, 6.5] }}>
            <ambientLight intensity={1.8} />
            <VRMModel vrm={vrm} mousePosition={mousePosition} />
          </Canvas>
        )}
      </div>
    </div>
  );
}
