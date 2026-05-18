import React from "react";
import { Canvas } from "@react-three/fiber";
import { Float, Text, Center, Ring, Cylinder, Html } from "@react-three/drei";
import { cn } from "@/lib/utils";

interface GhostLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "fullscreen";
}

const sizeClasses = {
  sm: "h-24 w-24",
  md: "h-48 w-48",
  lg: "h-64 w-64",
  fullscreen: "h-screen w-screen",
};

export function GhostLoader({ className, size = "fullscreen" }: GhostLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-background",
        sizeClasses[size],
        className,
      )}
    >
      <div className="relative w-full h-full">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} />

          <Float speed={2} rotationIntensity={0.5} floatIntensity={1.5} floatingRange={[-0.1, 0.1]}>
            <Center>
              <group>
                {/* Minimalist 3D "Thali" / Plate */}
                <Cylinder
                  args={[2.2, 2.2, 0.1, 64]}
                  rotation={[Math.PI / 2, 0, 0]}
                  position={[0, 0, -0.5]}
                >
                  <meshStandardMaterial
                    color="hsl(var(--primary))"
                    transparent
                    opacity={0.15}
                    roughness={0.2}
                    metalness={0.8}
                  />
                </Cylinder>
                <Ring args={[2.1, 2.3, 64]} position={[0, 0, -0.45]}>
                  <meshStandardMaterial
                    color="hsl(var(--primary))"
                    transparent
                    opacity={0.4}
                    emissive="hsl(var(--primary))"
                    emissiveIntensity={0.5}
                  />
                </Ring>

                {/* Floating Text Logo */}
                <Text
                  font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
                  fontSize={0.6}
                  letterSpacing={-0.05}
                  color="hsl(var(--foreground))"
                  position={[0, 0, 0.2]}
                  outlineWidth={0.02}
                  outlineColor="hsl(var(--primary))"
                >
                  Mom's Kitchen
                </Text>
              </group>
            </Center>
          </Float>
        </Canvas>
      </div>
    </div>
  );
}
